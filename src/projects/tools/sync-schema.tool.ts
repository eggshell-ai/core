import { Tool } from './tool.interface';
import * as vm from 'vm';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface FieldDefinition {
  name: string;
  type: string;
  label?: string;
  table?: boolean;
  form?: boolean;
  length?: number;
  required?: boolean;
  unique?: boolean;
  email?: boolean;
  source?: string;
  sortable?: boolean;
  searchable?: boolean;
  password?: boolean;
  accept?: string;
  maxSize?: number;
  resource?: string | any;
  map?: string;
  columns?: any[];
}

interface ResourceDefinition {
  name: string;
  endpoint: string;
  fields: FieldDefinition[];
  titleExpression?: string;
}

export class SyncSchemaTool implements Tool {
  name = 'sync_schema';
  description = 'Generates React frontend resource and Symfony backend PHP entity from a JavaScript-defined schema.';
  parameters = {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript code to generate the schema using defineResource and field builders.',
      },
      projectPath: {
        type: 'string',
        description: 'Overrides the target project directory.',
      },
    },
    required: ['code'],
  };

  async execute(args: { code: string; projectPath?: string }): Promise<any> {
    try {
      const resourceDefinitions = this.parseSchemaCode(args.code);
      console.log(`[SyncSchemaTool] Parsed ${resourceDefinitions.length} resource definition(s):`, resourceDefinitions);
      
      const projectPath = args.projectPath || path.resolve(process.cwd(), 'content', 'dummy-project');
      
      const frontendResourcePaths: string[] = [];
      const backendEntityPaths: string[] = [];

      for (const resourceDefinition of resourceDefinitions) {
        // Generate frontend resource
        const frontendResourcePath = await this.generateFrontendResource(projectPath, resourceDefinition);
        frontendResourcePaths.push(frontendResourcePath);
        
        // Generate backend entity
        const backendEntityPath = await this.generateBackendEntity(projectPath, resourceDefinition);
        backendEntityPaths.push(backendEntityPath);
      }
      
      // Run migrations
      await this.runMigrations(projectPath);
      
      return {
        success: true,
        message: 'Schema sync completed successfully.',
        details: {
          resources: resourceDefinitions.map(r => r.name),
          frontendResourcePaths,
          backendEntityPaths,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`[SyncSchemaTool] Error:`, error);
      return {
        success: false,
        message: 'Schema sync failed.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private parseSchemaCode(code: string): ResourceDefinition[] {
    // Strip ES imports and export default expressions
    let cleanCode = code
      .replace(/import\s+.*from\s+['"][^'"]+['"];?\s*/g, '')
      .replace(/export\s+default\s+/g, '')
      .replace(/export\s+/g, '')
      .trim();
    
    // Create sandbox context with mock defineResource and field
    const fieldMethods = [
      'label', 'table', 'form', 'length', 'required', 'email', 'unique',
      'source', 'sortable', 'searchable', 'password', 'accept', 'maxSize',
      'file', 'resource', 'map', 'columns', 'foreign'
    ];
    
    const createFieldProxy = (initialType: string, initialName: string) => {
      const fieldData: FieldDefinition = {
        name: initialName,
        type: initialType,
      };
      
      const handler: ProxyHandler<any> = {
        get(target, prop) {
          if (prop === 'read') {
            return () => ({ ...fieldData });
          }
          
          if (typeof prop === 'string' && fieldMethods.includes(prop)) {
            return (...args: any[]) => {
              if (prop === 'label') fieldData.label = args[0];
              if (prop === 'table') fieldData.table = true;
              if (prop === 'form') fieldData.form = true;
              if (prop === 'length') fieldData.length = args[0];
              if (prop === 'required') fieldData.required = true;
              if (prop === 'email') fieldData.email = true;
              if (prop === 'unique') fieldData.unique = true;
              if (prop === 'source') fieldData.source = args[0];
              if (prop === 'sortable') fieldData.sortable = true;
              if (prop === 'searchable') fieldData.searchable = true;
              if (prop === 'password') fieldData.password = true;
              if (prop === 'accept') fieldData.accept = args[0];
              if (prop === 'maxSize') fieldData.maxSize = args[0];
              if (prop === 'resource') fieldData.resource = args[0];
              if (prop === 'map') fieldData.map = args[0];
              if (prop === 'columns') fieldData.columns = args[0];
              return proxy;
            };
          }
          return target[prop];
        },
      };
      
      const proxy = new Proxy({}, handler);
      return proxy;
    };
    
    const fieldProxy = new Proxy({}, {
      get(target, prop) {
        if (typeof prop === 'string') {
          return (name: string) => createFieldProxy(prop, name);
        }
        return undefined;
      },
    });
    
    const capturedResources: ResourceDefinition[] = [];
    
    const defineResource = (config: any) => {
      // Extract field data from proxy objects using read() method
      const extractedFields = (config.fields || []).map((f: any) => {
        return typeof f?.read === 'function' ? f.read() : f;
      });
      
      const resource: ResourceDefinition = {
        name: config.name,
        endpoint: config.endpoint,
        fields: extractedFields,
        titleExpression: config.titleExpression,
      };
      capturedResources.push(resource);
      return resource;
    };
    
    const context = vm.createContext({
      defineResource,
      field: fieldProxy,
    });
    
    vm.runInContext(cleanCode, context);
    
    if (capturedResources.length === 0) {
      throw new Error('Failed to parse resource definition from code');
    }
    
    return capturedResources;
  }

  private async generateFrontendResource(projectPath: string, resource: ResourceDefinition): Promise<string> {
    const className = this.toPascalCase(resource.name);
    
    // Determine the correct resources directory
    let resourcesDir = path.join(projectPath, 'frontend', 'src', 'resources');
    if (!fs.existsSync(resourcesDir)) {
      resourcesDir = path.join(projectPath, 'frontend', 'resources');
    }
    
    if (!fs.existsSync(resourcesDir)) {
      fs.mkdirSync(resourcesDir, { recursive: true });
    }
    
    const resourcePath = path.join(resourcesDir, `${resource.name}.ts`);
    
    // Generate the resource code
    const resourceCode = this.generateFrontendResourceCode(resource, className);
    
    fs.writeFileSync(resourcePath, resourceCode, 'utf-8');
    
    return resourcePath;
  }

  private generateFrontendResourceCode(resource: ResourceDefinition, className: string): string {
    const serviceName = `${resource.name}Service`;
    
    return `import defineResource from '../utils/defineResource';
import field from '../utils/field';
import ${serviceName} from '../api/${serviceName}';

export default defineResource({
  name: "${resource.name}",
  endpoint: "${resource.endpoint}",
  fields: [
${resource.fields.map(f => this.generateFieldDefinition(f)).join(',\n')}
  ],
  titleExpression: "${resource.titleExpression || '{id}'}"
});
`;
  }

  private generateFieldDefinition(field: FieldDefinition): string {
    let code = `    field.${field.type}("${field.name}")`;
    
    if (field.label) code += `\n      .label("${field.label}")`;
    if (field.resource) {
      if (typeof field.resource === 'string') {
        code += `\n      .resource("${field.resource}")`;
      } else {
        code += `\n      .resource(${JSON.stringify(field.resource)})`;
      }
    }
    if (field.map) code += `\n      .map("${field.map}")`;
    if (field.columns) code += `\n      .columns(${JSON.stringify(field.columns)})`;
    if (field.type !== 'table' && field.table) code += `\n      .table()`;
    if (field.form) code += `\n      .form()`;
    if (field.length) code += `\n      .length(${field.length})`;
    if (field.required) code += `\n      .required()`;
    if (field.email) code += `\n      .email()`;
    if (field.unique) code += `\n      .unique()`;
    if (field.source) code += `\n      .source("${field.source}")`;
    if (field.sortable) code += `\n      .sortable()`;
    if (field.searchable) code += `\n      .searchable()`;
    if (field.password) code += `\n      .password()`;
    
    return code;
  }

  private async generateBackendEntity(projectPath: string, resource: ResourceDefinition): Promise<string> {
    const singularName = this.toSingular(resource.name);
    const className = this.toPascalCase(singularName);
    
    const entityDir = path.join(projectPath, 'backend', 'src', 'Entity');
    if (!fs.existsSync(entityDir)) {
      fs.mkdirSync(entityDir, { recursive: true });
    }
    
    const entityPath = path.join(entityDir, `${className}.php`);
    
    const entityCode = this.generateBackendEntityCode(resource, className);
    
    fs.writeFileSync(entityPath, entityCode, 'utf-8');
    
    return entityPath;
  }

  private generateBackendEntityCode(resource: ResourceDefinition, className: string): string {
    const imports = this.generateEntityImports(resource, className);
    const classProperties = this.generateEntityProperties(resource);
    const uniqueConstraints = this.generateUniqueConstraints(resource);
    const getTitleMethod = this.generateGetTitleMethod(resource);
    
    return `<?php

namespace App\\Entity;

${imports}

#[ORM\\Entity()]
#[ORM\\Table(name: '${resource.name}')]
${uniqueConstraints}
class ${className} extends ResourceEntity${this.getClassInterfaces(className)}
{
    #[ORM\\Id]
    #[ORM\\GeneratedValue]
    #[ORM\\Column]
    #[Table(label: "ID", sortable: true)]
    public ?int $id = null;

${classProperties}

${getTitleMethod}
}
`;
  }

  private generateEntityImports(resource: ResourceDefinition, className: string): string {
    const imports: string[] = [
      'use Doctrine\\ORM\\Mapping as ORM;',
      'use App\\Resource\\ResourceEntity;',
    ];
    
    const hasTable = resource.fields.some(f => f.table);
    const hasForm = resource.fields.some(f => f.form);
    const hasUnique = resource.fields.some(f => f.unique);
    const hasEmail = resource.fields.some(f => f.email);
    const hasFile = resource.fields.some(f => f.type === 'file');
    const hasMap = resource.fields.some(f => !!f.map);
    
    const hasRelation = resource.fields.some(f => f.resource && f.type !== 'table');
    
    if (hasTable) imports.push('use App\\Resource\\Attribute\\Table;');
    if (hasForm) imports.push('use App\\Resource\\Attribute\\Form;');
    if (hasRelation) imports.push('use App\\Resource\\Attribute\\Relation;');
    if (hasUnique) imports.push('use Symfony\\Bridge\\Doctrine\\Validator\\Constraints\\UniqueEntity;');
    if (hasEmail) imports.push('use Symfony\\Component\\Validator\\Constraints as Assert;');
    if (hasFile) imports.push('use App\\Resource\\FileField;');
    if (hasMap) imports.push('use App\\Resource\\MapField;');
    
    if (className === 'User') {
      imports.push('use Symfony\\Component\\Security\\Core\\User\\UserInterface;');
      imports.push('use Symfony\\Component\\Security\\Core\\User\\PasswordAuthenticatedUserInterface;');
    }
    
    return imports.join('\n');
  }

  private generateEntityProperties(resource: ResourceDefinition): string {
    return resource.fields.map(field => {
      let phpType = this.getPhpType(field.type);
      let attributes: string[] = [];
      
      if (field.type !== 'table') {
        let columnAttrs: string[] = [];
        if (field.length) columnAttrs.push(`length: ${field.length}`);
        if (field.unique) columnAttrs.push('unique: true');
        if (field.password) columnAttrs.push('options: ["comment" => "hashed password"]');
        if (!field.required) columnAttrs.push('nullable: true');
        
        const columnAttr = columnAttrs.length > 0 ? `#[ORM\\Column(${columnAttrs.join(', ')})]` : '#[ORM\\Column]';
        attributes.push(columnAttr);
      }
      
      if (field.map) {
        if (field.type === 'table' && field.resource) {
          const targetEntityName = typeof field.resource === 'string' ? field.resource : field.resource?.name;
          if (targetEntityName) {
            const singularTarget = this.toSingular(targetEntityName);
            const targetClassName = this.toPascalCase(singularTarget);
            attributes.push(`#[MapField(field: '${field.map}', targetEntity: ${targetClassName}::class)]`);
          } else {
            attributes.push(`#[MapField('${field.map}')]`);
          }
        } else {
          attributes.push(`#[MapField('${field.map}')]`);
        }
      }
      
      if (field.table) {
        const tableAttrs = [`label: "${field.label || field.name}"`];
        if (field.sortable) tableAttrs.push('sortable: true');
        if (field.searchable) tableAttrs.push('searchable: true');
        attributes.push(`#[Table(${tableAttrs.join(', ')})]`);
      }
      
      if (field.form) {
        const formAttrs = [`label: "${field.label || field.name}"`];
        formAttrs.push(`type: "${field.type}"`);
        if (field.required) formAttrs.push('required: true');
        if (field.accept) formAttrs.push(`accept: "${field.accept}"`);
        if (field.maxSize) formAttrs.push(`maxSize: ${field.maxSize}`);
        attributes.push(`#[Form(${formAttrs.join(', ')})]`);
      }
      
      if (field.email) {
        attributes.push('#[Assert\\Email]');
      }
      
      if (field.type === 'file') {
        attributes.push('#[FileField]');
      }

      let extraProp = '';
      if (field.resource && field.type !== 'table') {
        const targetEntityName = typeof field.resource === 'string' ? field.resource : field.resource?.name;
        if (targetEntityName) {
          const singularTarget = this.toSingular(targetEntityName);
          const targetClassName = this.toPascalCase(singularTarget);
          attributes.unshift(`#[Relation(targetEntity: ${targetClassName}::class)]`);
          extraProp = `\n\n    public ?string $${field.name}_title = null;`;
        }
      }

      if (field.type === 'table') {
        extraProp = `\n\n    public ?string $${field.name}_summary = null;`;
      }
      
      return `    ${attributes.join('\n    ')}
    public ?${phpType} $${field.name} = null;${extraProp}`;
    }).join('\n\n');
  }

  private generateUniqueConstraints(resource: ResourceDefinition): string {
    const uniqueFields = resource.fields.filter(f => f.unique);
    
    if (uniqueFields.length === 0) return '';
    
    let constraints = '';
    const className = this.toPascalCase(this.toSingular(resource.name));
    
    uniqueFields.forEach(field => {
      const constraintName = `UNIQ_IDENTIFIER_${field.name.toUpperCase()}`;
      constraints += `#[ORM\\UniqueConstraint(name: '${constraintName}', fields: ['${field.name}'])]\n`;
      constraints += `#[UniqueEntity(fields: ['${field.name}'], message: '${className} with this ${field.name} already exists')]\n`;
    });
    
    return constraints;
  }

  private generateGetTitleMethod(resource: ResourceDefinition): string {
    if (!resource.titleExpression) {
      return '    public function getTitle(): string\n    {\n        return (string) $this->id;\n    }\n';
    }
    
    // Parse title expression like "{first_name} {last_name}"
    const parts = resource.titleExpression.match(/\{([^}]+)\}/g);
    
    if (!parts) {
      return '    public function getTitle(): string\n    {\n        return (string) $this->id;\n    }\n';
    }
    
    const fieldNames = parts.map(p => p.replace(/[{}]/g, ''));
    const phpExpression = fieldNames.map(f => `$this->${f}`).join(' . \' \' . ');
    
    return `    public function getTitle(): string
    {
        return ${phpExpression};
    }
`;
  }

  private getClassInterfaces(className: string): string {
    if (className === 'User') {
      return ' implements UserInterface, PasswordAuthenticatedUserInterface';
    }
    return '';
  }

  private getPhpType(type: string): string {
    const typeMap: Record<string, string> = {
      text: 'string',
      email: 'string',
      password: 'string',
      number: 'int',
      foreign: 'int',
      select: 'string',
      boolean: 'bool',
      date: 'string',
      textarea: 'string',
      file: 'string',
      table: 'array',
    };
    
    return typeMap[type] || 'string';
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[_\s-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private toSingular(str: string): string {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('ses')) return str;
    if (str.endsWith('s')) return str.slice(0, -1);
    return str;
  }

  private async runMigrations(projectPath: string): Promise<void> {
    const backendDir = path.join(projectPath, 'backend');
    
    console.log(`[SyncSchemaTool] Running migrations in:`, backendDir);
    
    const constrainedEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      APPDATA: process.env.APPDATA,
      COMPOSER_HOME: process.env.COMPOSER_HOME,
      USERPROFILE: process.env.USERPROFILE, // Windows
      SystemRoot: process.env.SystemRoot,   // Windows
    };
    
    try {
      // Create migration
      console.log(`[SyncSchemaTool] Creating migration...`);
      await execAsync('php bin/console make:migration', { cwd: backendDir, env: constrainedEnv });
      
      // Execute migration
      console.log(`[SyncSchemaTool] Executing migration...`);
      await execAsync('php bin/console doctrine:migrations:migrate --no-interaction', { cwd: backendDir, env: constrainedEnv });
      
      console.log(`[SyncSchemaTool] Migrations completed successfully.`);
    } catch (error) {
      console.error(`[SyncSchemaTool] Migration error:`, error);
      throw new Error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

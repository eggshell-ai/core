import { SyncSchemaTool } from './sync-schema.tool';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('SyncSchemaTool', () => {
  let tool: SyncSchemaTool;
  let tempDir: string;

  beforeEach(() => {
    tool = new SyncSchemaTool();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-schema-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Tool metadata', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('sync_schema');
    });

    it('should have correct description', () => {
      expect(tool.description).toBe('Generates React frontend resource and Symfony backend PHP entity from a JavaScript-defined schema.');
    });

    it('should require code parameter', () => {
      expect(tool.parameters.required).toContain('code');
    });

    it('should have code and projectPath properties', () => {
      expect(tool.parameters.properties.code).toBeDefined();
      expect(tool.parameters.properties.projectPath).toBeDefined();
    });
  });

  describe('Code parsing and sandbox extraction', () => {
    it('should parse simple resource definition', () => {
      const code = `
        defineResource({
          name: "users",
          endpoint: "/users",
          fields: [
            field.text("first_name").label("First Name").table().form()
          ]
        });
      `;

      const resourceDefinition = (tool as any).parseSchemaCode(code);

      expect(resourceDefinition.name).toBe('users');
      expect(resourceDefinition.endpoint).toBe('/users');
      expect(resourceDefinition.fields).toHaveLength(1);
      expect(resourceDefinition.fields[0].name).toBe('first_name');
      expect(resourceDefinition.fields[0].type).toBe('text');
      expect(resourceDefinition.fields[0].label).toBe('First Name');
      expect(resourceDefinition.fields[0].table).toBe(true);
      expect(resourceDefinition.fields[0].form).toBe(true);
    });

    it('should strip ES imports', () => {
      const code = `
        import defineResource from '../utils/defineResource';
        import field from '../utils/field';
        
        defineResource({
          name: "users",
          endpoint: "/users",
          fields: []
        });
      `;

      const resourceDefinition = (tool as any).parseSchemaCode(code);
      expect(resourceDefinition.name).toBe('users');
    });

    it('should strip export default', () => {
      const code = `
        export default defineResource({
          name: "users",
          endpoint: "/users",
          fields: []
        });
      `;

      const resourceDefinition = (tool as any).parseSchemaCode(code);
      expect(resourceDefinition.name).toBe('users');
    });

    it('should parse complex field definitions', () => {
      const code = `
        defineResource({
          name: "users",
          endpoint: "/users",
          fields: [
            field.text("first_name").label("First Name").table().form().length(180).required(),
            field.email("email").table().form().email().unique(),
            field.password('password').password().form()
          ]
        });
      `;

      const resourceDefinition = (tool as any).parseSchemaCode(code);

      expect(resourceDefinition.fields).toHaveLength(3);
      
      const firstName = resourceDefinition.fields[0];
      expect(firstName.name).toBe('first_name');
      expect(firstName.length).toBe(180);
      expect(firstName.required).toBe(true);

      const email = resourceDefinition.fields[1];
      expect(email.name).toBe('email');
      expect(email.email).toBe(true);
      expect(email.unique).toBe(true);

      const password = resourceDefinition.fields[2];
      expect(password.name).toBe('password');
      expect(password.password).toBe(true);
    });

    it('should parse titleExpression', () => {
      const code = `
        defineResource({
          name: "users",
          endpoint: "/users",
          fields: [],
          titleExpression: "{first_name} {last_name}"
        });
      `;

      const resourceDefinition = (tool as any).parseSchemaCode(code);
      expect(resourceDefinition.titleExpression).toBe('{first_name} {last_name}');
    });

    it('should throw error for invalid code', () => {
      const code = 'invalid javascript code';
      
      expect(() => {
        (tool as any).parseSchemaCode(code);
      }).toThrow();
    });

    it('should support read() method to access field data', () => {
      const code = `
        const f = field.password('password').password().form();
        const data = f.read();
        defineResource({
          name: "users",
          endpoint: "/users",
          fields: [f]
        });
      `;

      const resourceDefinition = (tool as any).parseSchemaCode(code);

      expect(resourceDefinition.fields[0].name).toBe('password');
      expect(resourceDefinition.fields[0].type).toBe('password');
      expect(resourceDefinition.fields[0].password).toBe(true);
      expect(resourceDefinition.fields[0].form).toBe(true);
    });
  });

  describe('Frontend resource generation', () => {
    it('should generate frontend resource file', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [
          { name: 'first_name', type: 'text', label: 'First Name', table: true, form: true }
        ],
        titleExpression: '{first_name}'
      };

      const frontendPath = await (tool as any).generateFrontendResource(tempDir, resourceDefinition);

      expect(fs.existsSync(frontendPath)).toBe(true);
      expect(frontendPath).toContain('users.ts');
    });

    it('should use src/resources directory if it exists', async () => {
      const srcResourcesDir = path.join(tempDir, 'frontend', 'src', 'resources');
      fs.mkdirSync(srcResourcesDir, { recursive: true });

      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [],
        titleExpression: '{id}'
      };

      const frontendPath = await (tool as any).generateFrontendResource(tempDir, resourceDefinition);
      expect(frontendPath).toMatch(/src[\\/]resources/);
    });

    it('should fallback to resources directory if src does not exist', async () => {
      const resourcesDir = path.join(tempDir, 'frontend', 'resources');
      fs.mkdirSync(resourcesDir, { recursive: true });

      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [],
        titleExpression: '{id}'
      };

      const frontendPath = await (tool as any).generateFrontendResource(tempDir, resourceDefinition);
      expect(frontendPath).toMatch(/frontend[\\/]resources/);
    });

    it('should generate correct resource code content', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [
          { name: 'first_name', type: 'text', label: 'First Name', table: true, form: true }
        ],
        titleExpression: '{first_name}'
      };

      const frontendPath = await (tool as any).generateFrontendResource(tempDir, resourceDefinition);
      const content = fs.readFileSync(frontendPath, 'utf-8');

      expect(content).toContain("import defineResource from '../utils/defineResource'");
      expect(content).toContain("import field from '../utils/field'");
      expect(content).toContain('import usersService from');
      expect(content).toContain('name: "users"');
      expect(content).toContain('endpoint: "/users"');
      expect(content).toContain('field.text("first_name")');
      expect(content).toContain('.label("First Name")');
    });
  });

  describe('Backend entity generation', () => {
    it('should generate backend entity file', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [
          { name: 'email', type: 'email', table: true, form: true, unique: true }
        ],
        titleExpression: '{email}'
      };

      const backendPath = await (tool as any).generateBackendEntity(tempDir, resourceDefinition);

      expect(fs.existsSync(backendPath)).toBe(true);
      expect(backendPath).toMatch(/User\.php/);
    });

    it('should generate correct PHP namespace and class', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [],
        titleExpression: '{id}'
      };

      const backendPath = await (tool as any).generateBackendEntity(tempDir, resourceDefinition);
      const content = fs.readFileSync(backendPath, 'utf-8');

      expect(content).toContain('namespace App\\Entity;');
      expect(content).toContain('class User extends ResourceEntity');
    });

    it('should include Table and Form imports when fields have table/form attributes', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [
          { name: 'name', type: 'text', table: true, form: true }
        ],
        titleExpression: '{name}'
      };

      const backendPath = await (tool as any).generateBackendEntity(tempDir, resourceDefinition);
      const content = fs.readFileSync(backendPath, 'utf-8');

      expect(content).toContain('use App\\Resource\\Attribute\\Table;');
      expect(content).toContain('use App\\Resource\\Attribute\\Form;');
    });

    it('should include UniqueEntity import when fields have unique attribute', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [
          { name: 'email', type: 'email', unique: true }
        ],
        titleExpression: '{email}'
      };

      const backendPath = await (tool as any).generateBackendEntity(tempDir, resourceDefinition);
      const content = fs.readFileSync(backendPath, 'utf-8');

      expect(content).toContain('use Symfony\\Bridge\\Doctrine\\Validator\\Constraints\\UniqueEntity;');
    });

    it('should include Assert import when fields have email attribute', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [
          { name: 'email', type: 'email', email: true }
        ],
        titleExpression: '{email}'
      };

      const backendPath = await (tool as any).generateBackendEntity(tempDir, resourceDefinition);
      const content = fs.readFileSync(backendPath, 'utf-8');

      expect(content).toContain('use Symfony\\Component\\Validator\\Constraints as Assert;');
    });

    it('should include UserInterface and PasswordAuthenticatedUserInterface for User class', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [],
        titleExpression: '{id}'
      };

      const backendPath = await (tool as any).generateBackendEntity(tempDir, resourceDefinition);
      const content = fs.readFileSync(backendPath, 'utf-8');

      expect(content).toContain('use Symfony\\Component\\Security\\Core\\User\\UserInterface;');
      expect(content).toContain('use Symfony\\Component\\Security\\Core\\User\\PasswordAuthenticatedUserInterface;');
      expect(content).toContain('implements UserInterface, PasswordAuthenticatedUserInterface');
    });

    it('should generate correct field properties with attributes', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [
          { name: 'email', type: 'email', label: 'Email', table: true, form: true, unique: true, email: true, length: 180 }
        ],
        titleExpression: '{email}'
      };

      const backendPath = await (tool as any).generateBackendEntity(tempDir, resourceDefinition);
      const content = fs.readFileSync(backendPath, 'utf-8');

      expect(content).toContain('public ?string $email = null;');
      expect(content).toContain('length: 180');
      expect(content).toContain('unique: true');
      expect(content).toContain('#[Assert\\Email]');
      expect(content).toContain('#[Table(label: "Email"');
      expect(content).toContain('#[Form(label: "Email"');
    });

    it('should generate unique constraints', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [
          { name: 'email', type: 'email', unique: true }
        ],
        titleExpression: '{email}'
      };

      const backendPath = await (tool as any).generateBackendEntity(tempDir, resourceDefinition);
      const content = fs.readFileSync(backendPath, 'utf-8');

      expect(content).toContain('#[ORM\\UniqueConstraint(name: \'UNIQ_IDENTIFIER_EMAIL\', fields: [\'email\'])]');
      expect(content).toContain('#[UniqueEntity(fields: [\'email\'], message: \'User with this email already exists\')]');
    });

    it('should generate getTitle method from titleExpression', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [],
        titleExpression: '{first_name} {last_name}'
      };

      const backendPath = await (tool as any).generateBackendEntity(tempDir, resourceDefinition);
      const content = fs.readFileSync(backendPath, 'utf-8');

      expect(content).toContain('public function getTitle(): string');
      expect(content).toContain('return $this->first_name . \' \' . $this->last_name;');
    });

    it('should default getTitle to id when no titleExpression', async () => {
      const resourceDefinition = {
        name: 'users',
        endpoint: '/users',
        fields: [],
        titleExpression: undefined
      };

      const backendPath = await (tool as any).generateBackendEntity(tempDir, resourceDefinition);
      const content = fs.readFileSync(backendPath, 'utf-8');

      expect(content).toContain('return (string) $this->id;');
    });
  });

  describe('Full execution integration', () => {
    it('should execute full workflow with valid code', async () => {
      const code = `
        defineResource({
          name: "users",
          endpoint: "/users",
          fields: [
            field.text("first_name").label("First Name").table().form(),
            field.email("email").table().form().email().unique()
          ],
          titleExpression: "{first_name}"
        });
      `;

      const result = await tool.execute({ code, projectPath: tempDir });

      expect(result.success).toBe(true);
      expect(result.details.resource).toBe('users');
      expect(result.details.frontendResourcePath).toBeDefined();
      expect(result.details.backendEntityPath).toBeDefined();
      expect(fs.existsSync(result.details.frontendResourcePath)).toBe(true);
      expect(fs.existsSync(result.details.backendEntityPath)).toBe(true);
    });

    it('should handle missing projectPath with default', async () => {
      const code = `
        defineResource({
          name: "users",
          endpoint: "/users",
          fields: []
        });
      `;

      const result = await tool.execute({ code });

      expect(result.success).toBe(true);
      // Should use default path
      expect(result.details.frontendResourcePath).toBeDefined();
    });

    it('should return error for invalid code', async () => {
      const code = 'invalid code';

      const result = await tool.execute({ code, projectPath: tempDir });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Helper methods', () => {
    it('should convert to PascalCase correctly', () => {
      expect((tool as any).toPascalCase('users')).toBe('Users');
      expect((tool as any).toPascalCase('user_profiles')).toBe('UserProfiles');
      expect((tool as any).toPascalCase('user-profiles')).toBe('UserProfiles');
      expect((tool as any).toPascalCase('user profiles')).toBe('UserProfiles');
    });

    it('should map field types to PHP types correctly', () => {
      expect((tool as any).getPhpType('text')).toBe('string');
      expect((tool as any).getPhpType('email')).toBe('string');
      expect((tool as any).getPhpType('password')).toBe('string');
      expect((tool as any).getPhpType('number')).toBe('int');
      expect((tool as any).getPhpType('boolean')).toBe('bool');
      expect((tool as any).getPhpType('select')).toBe('string');
      expect((tool as any).getPhpType('unknown')).toBe('string');
    });
  });
});

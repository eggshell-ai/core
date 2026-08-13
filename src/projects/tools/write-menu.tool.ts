import { Tool } from './tool.interface';
import * as fs from 'fs';
import * as path from 'path';

export class WriteMenuTool implements Tool {
  name = 'write_menu';
  description = 'Adds or updates a menu item in the menu.json file.';
  parameters = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'The menu path in dot notation (e.g., Inventory.Products)',
      },
      route: {
        type: 'string',
        description: 'The route path for the menu item (e.g., /products)',
      },
      icon: {
        type: 'string',
        description: 'The icon name from @ant-design/icons (e.g., DashboardOutlined)',
      },
      after: {
        type: 'string',
        description: 'Optional menu item name to insert after. If empty, inserts at 2nd last position.',
      },
      permission: {
        type: 'string',
        description: 'Optional permission string (e.g., products.view)',
      },
      projectPath: {
        type: 'string',
        description: 'Overrides the target project directory.',
      },
    },
    required: ['name', 'route', 'icon'],
  };

  async execute(args: { name: string; route: string; icon: string; after?: string; permission?: string; projectPath?: string }): Promise<any> {
    try {
      console.log(`[WriteMenuTool] Adding menu item:`, args.name);
      
      const projectPath = args.projectPath || path.resolve(process.cwd(), 'content', 'dummy-project');
      
      const menuPath = await this.addToMenu(projectPath, args.name, args.route, args.icon, args.after, args.permission);
      
      return {
        success: true,
        message: 'Menu item added successfully.',
        details: {
          name: args.name,
          route: args.route,
          icon: args.icon,
          menuPath,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`[WriteMenuTool] Error:`, error);
      return {
        success: false,
        message: 'Menu item creation failed.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async addToMenu(projectPath: string, name: string, route: string, icon: string, after?: string, permission?: string): Promise<string> {
    // Construct the path to schemas/menu.json
    const frontendDir = path.join(projectPath, 'frontend');
    const schemasDir = path.join(frontendDir, 'schemas');
    
    // Ensure the schemas directory exists
    if (!fs.existsSync(schemasDir)) {
      fs.mkdirSync(schemasDir, { recursive: true });
    }
    
    const menuFilePath = path.join(schemasDir, 'menu.json');
    
    // Read existing menu or create new one
    let menuData: any[] = [];
    if (fs.existsSync(menuFilePath)) {
      const existingContent = fs.readFileSync(menuFilePath, 'utf-8');
      menuData = JSON.parse(existingContent);
    }
    
    // Add or overwrite the menu item
    const menuIndex = menuData.findIndex(item => item.name === name);
    const menuItem: any = {
      name: name,
      route: route,
      icon: icon,
    };
    
    // Add permission if provided
    if (permission) {
      menuItem.permission = permission;
    }
    
    if (menuIndex >= 0) {
      menuData[menuIndex] = menuItem;
    } else {
      // Determine insert position
      let insertIndex: number;
      
      if (after && after.length > 0) {
        // Find the index of the "after" item
        const afterIndex = menuData.findIndex(item => item.name === after);
        if (afterIndex >= 0) {
          insertIndex = afterIndex + 1;
        } else {
          // If "after" item not found, insert at 2nd last position
          insertIndex = Math.max(0, menuData.length - 1);
        }
      } else {
        // Insert at 2nd last position
        insertIndex = Math.max(0, menuData.length - 1);
      }
      
      menuData.splice(insertIndex, 0, menuItem);
    }
    
    // Write the updated menu
    fs.writeFileSync(menuFilePath, JSON.stringify(menuData, null, 2), 'utf-8');
    
    console.log(`[WriteMenuTool] Menu updated at:`, menuFilePath);
    return menuFilePath;
  }
}

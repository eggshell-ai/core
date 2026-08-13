import { Injectable, Logger } from '@nestjs/common';
import { LLMService, LLMMessage } from './llm.service.interface';
import { OllamaService } from './ollama.service';

@Injectable()
export class MockLLMService implements LLMService {
  private readonly logger = new Logger(MockLLMService.name);

  constructor(private readonly ollamaService: OllamaService) {}

  async executePrompt(prompt: string, context?: Record<string, any>): Promise<string> {
    return this.ollamaService.executePrompt(prompt, context);
  }

  async executePromptWithTools(
    messages: LLMMessage[],
    tools: Array<{ name: string; description: string; parameters: any }>,
    context?: Record<string, any>,
  ): Promise<any> {
    const completedToolCalls = messages.filter(message => message.role === 'tool').length;

    switch (completedToolCalls) {
      case 0:
        return this.response('Loading the CRUD and analytics instructions before building the sales system.', [
          this.toolCall('mock_load_crud_skill', 'load_skill', { skillName: 'crud_creation' }),
          this.toolCall('mock_load_analytics_skill', 'load_skill', { skillName: 'analytics_and_reporting' }),
        ]);

      case 2:
        return this.response('Creating schemas for products, customers, invoice items, and invoices.', [
          this.toolCall('mock_sync_products', 'sync_schema', { code: this.productsSchema() }),
          this.toolCall('mock_sync_customers', 'sync_schema', { code: this.customersSchema() }),
          this.toolCall('mock_sync_invoice_items', 'sync_schema', { code: this.invoiceItemsSchema() }),
          this.toolCall('mock_sync_invoices', 'sync_schema', { code: this.invoicesSchema() }),
        ]);

      case 6:
        return this.response('Creating the three resource controllers.', [
          this.toolCall('mock_product_controller', 'write_controller', this.controller('Product', 'products')),
          this.toolCall('mock_customer_controller', 'write_controller', this.controller('Customer', 'customers')),
          this.toolCall('mock_invoice_controller', 'write_controller', this.controller('Invoice', 'invoices')),
        ]);

      case 9:
        return this.response('Creating CRUD pages for the sales resources.', [
          this.toolCall('mock_products_page', 'write_page', this.page('Products', 'products')),
          this.toolCall('mock_customers_page', 'write_page', this.page('Customers', 'customers')),
          this.toolCall('mock_invoices_page', 'write_page', this.page('Invoices', 'invoices')),
        ]);

      case 12:
        return this.response('Adding the sales resources to the navigation menu.', [
          this.toolCall('mock_products_menu', 'write_menu', { name: 'Sales.Products', route: '/products', icon: 'ShoppingOutlined', after: 'Dashboard', permission: 'products.view' }),
          this.toolCall('mock_customers_menu', 'write_menu', { name: 'Sales.Customers', route: '/customers', icon: 'TeamOutlined', after: 'Sales.Products', permission: 'customers.view' }),
          this.toolCall('mock_invoices_menu', 'write_menu', { name: 'Sales.Invoices', route: '/invoices', icon: 'FileTextOutlined', after: 'Sales.Customers', permission: 'invoices.view' }),
        ]);

      case 15:
        return this.response('Creating dashboard aggregators for the sales KPIs.', [
          this.toolCall('mock_product_count_aggregator', 'write_file', this.countAggregator('Product', 'products', 'p')),
          this.toolCall('mock_customer_count_aggregator', 'write_file', this.countAggregator('Customer', 'customers', 'c')),
          this.toolCall('mock_invoice_count_aggregator', 'write_file', this.countAggregator('Invoice', 'invoices', 'i')),
          this.toolCall('mock_invoice_total_aggregator', 'write_file', this.invoiceTotalAggregator()),
        ]);

      case 19:
        return this.response('Reading the current dashboard before adding the sales KPI cards.', [
          this.toolCall('mock_read_dashboard', 'read_file', { shell: 'frontend', path: 'views/dashboard/default.jsx' }),
        ]);

      case 20:
        return this.response('Adding four sales KPI cards to the dashboard.', [
          this.toolCall('mock_write_dashboard', 'write_file', {
            shell: 'frontend',
            path: 'views/dashboard/default.jsx',
            content: this.dashboardPage(),
          }),
        ]);

      case 21:
        return this.response(
          'The mock sales system generation is complete: products, customers, and invoices each have a schema, controller, CRUD page, and menu entry. Invoice items has a schema only and is used as an invoice line-item table. The dashboard now includes cards for product count, customer count, invoice count, and total invoiced value.',
          [],
        );

      default:
        this.logger.warn(`MockLLM received an unexpected tool-result count: ${completedToolCalls}`);
        return this.response('The mock generation flow stopped because its tool-call sequence was interrupted.', []);
    }
  }

  private response(content: string, tool_calls: any[]): { content: string; tool_calls: any[] } {
    this.logger.log(`MockLLM: ${content}`);
    return { content, tool_calls };
  }

  private toolCall(id: string, name: string, arguments_: Record<string, any>): any {
    return { id, type: 'function', function: { name, arguments: JSON.stringify(arguments_) } };
  }

  private productsSchema(): string {
    return `defineResource({
  name: 'products',
  endpoint: '/products',
  titleExpression: '{name}',
  fields: [
    field.text('name').label('Product Name').table().form().required().searchable(),
    field.text('sku').label('SKU').table().form().required().unique(),
    field.number('price').label('Unit Price').table().form().required().sortable(),
    field.boolean('active').label('Active').table().form()
  ]
})`;
  }

  private customersSchema(): string {
    return `defineResource({
  name: 'customers',
  endpoint: '/customers',
  titleExpression: '{name}',
  fields: [
    field.text('name').label('Customer Name').table().form().required().searchable(),
    field.email('email').label('Email').table().form().required().unique(),
    field.text('phone').label('Phone').table().form(),
    field.boolean('active').label('Active').table().form()
  ]
})`;
  }

  private invoicesSchema(): string {
    return `defineResource({
  name: 'invoices',
  endpoint: '/invoices',
  titleExpression: '{invoice_number}',
  fields: [
    field.text('invoice_number').label('Invoice Number').table().form().required().unique().searchable(),
    field.select('customer').label('Customer').resource('customers').table().form().required(),
    field.date('invoice_date').label('Invoice Date').table().form().required().sortable(),
    field.number('total_amount').label('Total Amount').table().form().required().sortable(),
    field.text('status').label('Status').table().form().required(),
    field.table('items').label('Invoice Items').resource('invoice_items').columns(['id', 'product_id', 'rate', 'amount']).form()
  ]
})`;
  }

  private invoiceItemsSchema(): string {
    return `defineResource({
  name: 'invoice_items',
  endpoint: '/invoice-items',
  fields: [
    field.select('product_id').label('Product').resource('products').required(),
    field.number('rate').label('Rate').required(),
    field.number('amount').label('Amount').required()
  ]
})`;
  }

  private controller(className: string, resourceName: string): Record<string, string> {
    return {
      controllerName: className,
      code: `<?php

namespace App\\Controller;

use App\\Entity\\${className};
use App\\Resource\\ResourceController;
use Symfony\\Component\\Routing\\Attribute\\Route;

#[Route('/api/${resourceName}', name: '${resourceName}.')]
final class ${className}Controller extends ResourceController
{
    protected function getEntityClass(): string
    {
        return ${className}::class;
    }

    protected function getResourceName(): string
    {
        return '${resourceName}';
    }
}
`,
    };
  }

  private page(title: string, resourceName: string): Record<string, string> {
    return {
      route: `/${resourceName}`,
      code: `'use client';

import ResourcePage from '@/components/resources/ResourcePage';
import ${resourceName}Resource from '@/resources/${resourceName}';

export default function ${title}Page() {
  return <ResourcePage resource={${resourceName}Resource} />;
}
`,
    };
  }

  private countAggregator(entity: string, resource: string, alias: string): Record<string, string> {
    const className = `${entity}CountAggregator`;
    return {
      shell: 'backend',
      path: `Service/Analytics/${className}.php`,
      content: `<?php

namespace App\\Service\\Analytics;

use App\\Entity\\${entity};
use Doctrine\\ORM\\EntityManagerInterface;

class ${className} implements AnalyticsAggregatorInterface
{
    public function __construct(private readonly EntityManagerInterface $entityManager) {}

    public function getName(): string
    {
        return '${resource}/count';
    }

    public function getValue(): int
    {
        return (int) $this->entityManager->getRepository(${entity}::class)
            ->createQueryBuilder('${alias}')
            ->select('COUNT(${alias}.id)')
            ->getQuery()
            ->getSingleScalarResult();
    }
}
`,
    };
  }

  private invoiceTotalAggregator(): Record<string, string> {
    return {
      shell: 'backend',
      path: 'Service/Analytics/InvoiceTotalAggregator.php',
      content: `<?php

namespace App\\Service\\Analytics;

use App\\Entity\\Invoice;
use Doctrine\\ORM\\EntityManagerInterface;

class InvoiceTotalAggregator implements AnalyticsAggregatorInterface
{
    public function __construct(private readonly EntityManagerInterface $entityManager) {}

    public function getName(): string
    {
        return 'invoices/total';
    }

    public function getValue(): int
    {
        return (int) $this->entityManager->getRepository(Invoice::class)
            ->createQueryBuilder('i')
            ->select('COALESCE(SUM(i.total_amount), 0)')
            ->getQuery()
            ->getSingleScalarResult();
    }
}
`,
    };
  }

  private dashboardPage(): string {
    return `'use client';

import Dashboard from 'components/dashboard/Dashboard';
import KPICard from 'components/cards/statistics/KPICard';

export default function DashboardDefault() {
  return (
    <Dashboard title="Sales Dashboard">
      <KPICard title="Products" endpoint="/analytics/products/count" size={{ xs: 12, sm: 6, lg: 3 }} />
      <KPICard title="Customers" endpoint="/analytics/customers/count" size={{ xs: 12, sm: 6, lg: 3 }} />
      <KPICard title="Invoices" endpoint="/analytics/invoices/count" size={{ xs: 12, sm: 6, lg: 3 }} />
      <KPICard title="Total Invoiced" endpoint="/analytics/invoices/total" size={{ xs: 12, sm: 6, lg: 3 }} />
    </Dashboard>
  );
}
`;
  }
}

import { generateObject } from "ai";
import { z } from "zod";
import { aiConfigService } from "./ai-config-service";
import type { AgentTask } from "./agents/shared/types";
import { AgentTaskStore } from "./agents/shared/types";
import { TaskStatus } from "./agents/shared/task-types";
import type { AutomationSolution } from "./solution-design-agent";
import { generatePrefixedUUID } from "./utils/uuid";
import { logger } from "./utils/structured-logger";

/* --------------------------- Utilities & Types --------------------------- */

// Use generatePrefixedUUID directly instead of wrapper

const supportedFrameworks = ['react', 'vue', 'angular'] as const;
type SupportedFramework = (typeof supportedFrameworks)[number];

const toKebab = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();

const toPascal = (s: string) =>
  s
    .replace(/(^\w|[\s-_]\w)/g, (m) => m.replace(/[\s-_]/, "").toUpperCase())
    .replace(/[^A-Za-z0-9]/g, "");

const safeIdent = (s: string, fallback = "Component") => {
  const p = toPascal(s);
  return p.length ? p : fallback;
};

export interface UIComponent {
  name: string;
  type: 'dashboard' | 'form' | 'table' | 'chart' | 'modal' | 'layout';
  purpose: string;
  code: string;
  dependencies: string[];
  props?: Record<string, unknown>;
}

export interface UITheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
  typography: {
    fontFamily: string;
    fontSize: Record<string, string>;
  };
}

export interface UIGenerationInput {
  solution: AutomationSolution;
  uiType: 'admin' | 'dashboard' | 'monitoring' | 'user-portal';
  theme?: UITheme;
  includeCharts?: boolean;
  includeRealTime?: boolean;
  framework: SupportedFramework;
}

export interface UIPage {
  name: string;
  path: string;
  components: string[];
  code: string;
  layout: string;
}

export interface UIGenerationOutput {
  components: UIComponent[];
  pages: UIPage[];
  routes: string;
  packageJson: Record<string, unknown>;
  configFiles: Record<string, string>;
  theme: UITheme;
}

export type UITask<TInput, TOutput> = {
  id: string;
  type: string;
  input: TInput;
  output?: TOutput;
  error?: string;
  status: TaskStatus;
  startedAt?: Date;
  completedAt?: Date;
};

/* ------------------------------- Zod Schemas ------------------------------- */

const UIRequirementsSchema = z.object({
  primaryFeatures: z.array(z.string()).default([]),
  dataVisualization: z.object({
    charts: z.array(z.string()).default([]),
    tables: z.array(z.string()).default([]),
    metrics: z.array(z.string()).default([]),
  }).default({ charts: [], tables: [], metrics: [] }),
  userInteractions: z.array(z.string()).default([]),
  realTimeFeatures: z.array(z.string()).default([]),
  navigationStructure: z.array(z.string()).default([]),
});
type UIRequirements = z.infer<typeof UIRequirementsSchema>;

const UIBlueprintSchema = z.object({
  pages: z.array(z.object({
    name: z.string(),
    path: z.string(),
    purpose: z.string(),
    components: z.array(z.string()),
  })),
  components: z.array(z.object({
    name: z.string(),
    type: z.enum(['dashboard', 'form', 'table', 'chart', 'modal', 'layout']),
    purpose: z.string(),
    props: z.record(z.unknown()).default({}),
  })),
  layout: z.object({
    navigation: z.array(z.string()).default([]),
    sidebar: z.boolean().default(true),
    header: z.boolean().default(true),
    footer: z.boolean().default(false),
  }),
});
type UIBlueprint = z.infer<typeof UIBlueprintSchema>;

/* ----------------------------- UIGeneratorAgent ---------------------------- */

export class UIGeneratorAgent {
  private tasksCompleted = 0;
  private status: "idle" | "busy" | "error" = "idle";

  private componentTemplates: Record<string, string> = {};

  constructor(private taskStore?: AgentTaskStore) {
    this.initializeTemplates();
  }

  /* --------------------------- Template Initialization --------------------------- */

  private initializeTemplates() {
    this.componentTemplates = {
      /* React Dashboard */
      'react-dashboard': `import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Activity, Users, TrendingUp } from 'lucide-react';

export default function {{componentName}}() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/{{apiEndpoint}}');
      if (!response.ok) throw new Error('Request failed');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{{title}}</h1>
        <Button onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin mr-2' : 'mr-2'} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {{metricCards}}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {{contentSections}}
      </div>
    </div>
  );
}`,

      /* React Form */
      'react-form': `import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function {{componentName}}() {
  const [formData, setFormData] = useState<any>({{initialState}});
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/{{apiEndpoint}}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Request failed');
      }

      setMessage('{{successMessage}}');
      setFormData({{initialState}});
    } catch (error: any) {
      setMessage(error?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{{title}}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
{{formFields}}

          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Processing...' : '{{submitText}}'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}`,

      /* React Table (no external libs) */
      'react-table': `import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function {{componentName}}() {
  const rows = ({{initialRows}} as any[]) || [];
  const columns = ({{initialColumns}} as string[]) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{{title}}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th key={i} className="border-b p-2 text-left text-sm font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b">
                  {columns.map((c, j) => (
                    <td key={j} className="p-2 text-sm">{String(r[c] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}`,
    };
  }

  /* --------------------------------- Public API --------------------------------- */

  async generateUI(input: UIGenerationInput): Promise<UITask<UIGenerationInput, UIGenerationOutput>> {
    const task: UITask<UIGenerationInput, UIGenerationOutput> = {
      id: generatePrefixedUUID("ui-generation"),
      type: "ui_generation",
      input,
      status: "running" as TaskStatus,
      startedAt: new Date(),
    };

    if (!supportedFrameworks.includes(input.framework)) {
      throw new Error(`Unsupported framework: ${input.framework}`);
    }

    this.status = "busy";
    // Persist best-effort; TaskStore type may vary across projects
    await this.taskStore?.create?.(task  as AgentTask<UIGenerationInput, UIGenerationOutput>);

    try {
      // 1) Analyze requirements
      const uiRequirements = await this.analyzeUIRequirements(input.solution, input.uiType);

      // 2) Blueprint
      const uiBlueprint = await this.generateUIBlueprint(uiRequirements, input);

      // 3) Components
      const components = await this.generateComponents(uiBlueprint, input.framework);

      // 4) Pages
      const pages = await this.generatePages(uiBlueprint, components, input.framework);

      // 5) Routing & Project files
      const routes = this.generateRouting(pages, input.framework);
      const packageJson = this.generatePackageJson(input.framework, components);
      const configFiles = this.generateConfigFiles(input.framework);

      // 6) Theme
      const theme = input.theme || this.generateDefaultTheme();

      task.output = { components, pages, routes, packageJson, configFiles, theme };
      task.status = "completed" as TaskStatus;
      task.completedAt = new Date();
      this.tasksCompleted++;
      this.status = "idle";

      await this.taskStore?.update?.(task.id, task as AgentTask<UIGenerationInput, UIGenerationOutput>);
      return task;

    } catch (error: any) {
      task.error = error?.message || "UI generation failed";
      task.status = "failed" as TaskStatus;
      task.completedAt = new Date();
      this.status = "error" as "idle" | "busy" | "error";
        await this.taskStore?.update?.(task.id, task as AgentTask<UIGenerationInput, UIGenerationOutput>);
      return task;
    }
  }

  /* --------------------------------- Internals ---------------------------------- */

  private async analyzeUIRequirements(solution: AutomationSolution, uiType: string): Promise<UIRequirements> {
    const { object } = await generateObject({
      model: await aiConfigService.getModelForAgent("llm"),
      schema: UIRequirementsSchema,
      prompt: `Analyze this automation solution and determine UI requirements for a ${uiType} interface:

Solution: ${solution.description}
Agents: ${solution.agents.map(a => `${a.name} - ${a.purpose}`).join(', ')}
Workflows: ${solution.workflows.map(w => `${w.name} - ${w.description}`).join(', ')}

Determine:
1. Primary features needed in the UI
2. Data visualization requirements (charts, tables, metrics)
3. User interaction patterns
4. Real-time features needed
5. Navigation structure

Focus on practical, business-oriented UI requirements.`,
    });

    return object;
  }

  private async generateUIBlueprint(requirements: UIRequirements, input: UIGenerationInput): Promise<UIBlueprint> {
    const { object } = await generateObject({
      model: await aiConfigService.getModelForAgent("llm"),
      schema: UIBlueprintSchema,
      prompt: `Create a detailed UI blueprint for a ${input.framework} ${input.uiType} interface:

Requirements: ${JSON.stringify(requirements, null, 2)}
Framework: ${input.framework}
UI Type: ${input.uiType}
Include Charts: ${!!input.includeCharts}
Include Real-time: ${!!input.includeRealTime}

Generate a comprehensive blueprint with:
1. Page structure and routing
2. Component specifications
3. Layout configuration
4. Navigation design

Make it production-ready and user-friendly.`,
    });

    return object;
  }

  private async generateComponents(blueprint: UIBlueprint, framework: SupportedFramework): Promise<UIComponent[]> {
    const out: UIComponent[] = [];

    for (const comp of blueprint.components) {
      const name = safeIdent(comp.name);
      const type = comp.type;
      const purpose = comp.purpose;
      const props = comp.props ?? {};

      let code = "";
      const dependencies: string[] = [];

      if (framework === 'react') {
        code = this.generateReactComponent({ ...comp, name, props });
        dependencies.push(
          "react",
          "react-router-dom",
          "lucide-react",
          "@/components/ui/card",
          "@/components/ui/button",
          "@/components/ui/badge",
          "@/components/ui/input",
          "@/components/ui/label",
          "@/components/ui/textarea",
          "@/components/ui/alert"
        );
      } else if (framework === 'vue') {
        code = this.generateVueComponent({ ...comp, name, props });
        dependencies.push("vue", "vue-router");
      } else {
        code = this.generateAngularComponent({ ...comp, name, props });
        dependencies.push("@angular/core", "@angular/common", "@angular/router", "@angular/platform-browser");
      }

      out.push({
        name,
        type,
        purpose,
        code,
        dependencies,
        props,
      });
    }

    return out;
  }

  private generateReactComponent(comp: { name: string; type: UIComponent['type']; purpose: string; props?: Record<string, unknown> }): string {
    const templateKey =
      comp.type === 'form' ? 'react-form'
      : comp.type === 'table' ? 'react-table'
      : 'react-dashboard';

    const template = this.componentTemplates[templateKey] || this.componentTemplates['react-dashboard'];

    const metrics = Array.isArray((comp.props as Record<string, unknown>)?.metrics) ? (comp.props as Record<string, unknown>).metrics : ['Total Items', 'Active Users', 'Success Rate', 'Response Time'];
    const initialRows = JSON.stringify((comp.props as Record<string, unknown>)?.rows ?? []);
    const initialCols = JSON.stringify((comp.props as Record<string, unknown>)?.columns ?? []);

    return template
      .replace(/\{\{componentName\}\}/g, safeIdent(comp.name))
      .replace(/\{\{title\}\}/g, comp.purpose)
      .replace(/\{\{apiEndpoint\}\}/g, toKebab(comp.name))
      .replace(/\{\{metricCards\}\}/g, this.generateMetricCards({ metrics: metrics as string[] }))
      .replace(/\{\{contentSections\}\}/g, this.generateContentSections())
      .replace(/\{\{formFields\}\}/g, this.generateFormFields(comp))
      .replace(/\{\{initialState\}\}/g, JSON.stringify((comp.props as any) ?? {}))
      .replace(/\{\{successMessage\}\}/g, `${comp.name} completed successfully`)
      .replace(/\{\{errorMessage\}\}/g, `Failed to process ${comp.name}`)
      .replace(/\{\{submitText\}\}/g, `Submit ${comp.name}`)
      .replace(/\{\{initialRows\}\}/g, initialRows)
      .replace(/\{\{initialColumns\}\}/g, initialCols);
  }

  private generateVueComponent(comp: { name: string; purpose: string; props?: Record<string, unknown> }) {
    return `<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">${comp.purpose}</h1>
      <button @click="fetchData" :disabled="loading" class="btn btn-primary">
        <span v-if="loading" class="animate-spin mr-2">⟳</span>
        Refresh
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Metrics -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const data = ref<any>(null);
const loading = ref<boolean>(true);

const fetchData = async () => {
  loading.value = true;
  try {
    const response = await fetch('/api/${toKebab(comp.name)}');
    if (!response.ok) throw new Error('Request failed');
    data.value = await response.json();
  } finally {
    loading.value = false;
  }
};

onMounted(fetchData);
</script>`;
  }

  private generateAngularComponent(comp: { name: string; purpose: string; props?: Record<string, unknown> }) {
    const className = `${safeIdent(comp.name)}Component`;
    const selector = `app-${toKebab(comp.name)}`;
    const endpoint = toKebab(comp.name);

    return `import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: '${selector}',
  template: \`
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold">${comp.purpose}</h1>
        <button (click)="fetchData()" [disabled]="loading" class="btn btn-primary">
          <span *ngIf="loading" class="animate-spin mr-2">⟳</span>
          Refresh
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Metrics -->
      </div>
    </div>
  \`
})
export class ${className} implements OnInit {
  data: any = null;
  loading = true;

  constructor(private http: HttpClient) {}

  ngOnInit() { this.fetchData(); }

  fetchData() {
    this.loading = true;
    this.http.get('/api/${endpoint}').subscribe({
      next: (result) => { this.data = result; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
}`;
  }

  private generateMetricCards({ metrics }: { metrics: string[] }): string {
    return metrics.map((metric) => {
      const key = metric.toLowerCase().replace(/[\s/]+/g, '_');
      return `
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">${metric}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.metrics?.${key} ?? '---'}</div>
            <p className="text-xs text-muted-foreground">
              +{data?.changes?.${key} ?? '0'}% from last period
            </p>
          </CardContent>
        </Card>`;
    }).join('\n');
  }

  private generateContentSections(): string {
    return `
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.activities?.map((activity: any, index: number) => (
                <div key={index} className="flex items-center space-x-4">
                  <Badge variant="outline">{activity.type}</Badge>
                  <span className="flex-1">{activity.description}</span>
                  <span className="text-sm text-muted-foreground">{activity.timestamp}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.status?.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <span>{item.service}</span>
                  <Badge variant={item.status === 'healthy' ? 'default' : 'destructive'}>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>`;
  }

  private generateFormFields(comp: { props?: Record<string, unknown> }): string {
    const fields = Array.isArray((comp.props as any)?.fields)
      ? (comp.props as any).fields
      : [
          { name: 'name', type: 'text', label: 'Name', required: true },
          { name: 'description', type: 'textarea', label: 'Description', required: false },
        ];

    return fields.map((field: any) => {
      const fname = field.name;
      if (field.type === 'textarea') {
        return `
          <div>
            <Label htmlFor="${fname}">${field.label}</Label>
            <Textarea
              id="${fname}"
              value={formData.${fname} ?? ''}
              onChange={(e) => setFormData({...formData, ${fname}: (e.target as HTMLTextAreaElement).value})}
              ${field.required ? 'required' : ''}
            />
          </div>`;
      }
      return `
          <div>
            <Label htmlFor="${fname}">${field.label}</Label>
            <Input
              id="${fname}"
              type="${field.type}"
              value={formData.${fname} ?? ''}
              onChange={(e) => setFormData({...formData, ${fname}: (e.target as HTMLInputElement).value})}
              ${field.required ? 'required' : ''}
            />
          </div>`;
    }).join('\n');
  }

  private async generatePages(blueprint: UIBlueprint, components: UIComponent[], framework: SupportedFramework): Promise<UIPage[]> {
    const pages: UIPage[] = [];

    for (const page of blueprint.pages) {
      let code = "";
      if (framework === 'react') code = this.generateReactPage(page, components);
      else if (framework === 'vue') code = this.generateVuePage(page, components);
      else code = this.generateAngularPage(page, components);

      pages.push({
        name: safeIdent(page.name, "Page"),
        path: page.path || `/${toKebab(page.name)}`,
        components: page.components.map((c) => safeIdent(c)),
        code,
        layout: 'default',
      });
    }

    return pages;
  }

  private generateReactPage(page: { name: string; purpose: string; components: string[] }, components: UIComponent[]): string {
    const imports = page.components.map((compName) =>
      `import ${safeIdent(compName)} from '@/components/${safeIdent(compName)}';`
    ).join('\n');

    const componentUsage = page.components.map((compName) =>
      `        <${safeIdent(compName)} />`
    ).join('\n');

    return `import React from 'react';
${imports}

export default function ${safeIdent(page.name)}Page() {
  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">${page.name}</h1>
          <p className="text-muted-foreground">${page.purpose}</p>
        </div>

${componentUsage}
      </div>
    </div>
  );
}`;
  }

  private generateVuePage(page: { name: string; purpose: string; components: string[] }, _components: UIComponent[]): string {
    const componentTags = page.components.map((compName) =>
      `      <${safeIdent(compName)} />`
    ).join('\n');

    const imports = page.components.map((compName) =>
      `import ${safeIdent(compName)} from '@/components/${safeIdent(compName)}.vue';`
    ).join('\n');

    return `<template>
  <div class="container mx-auto py-6">
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-bold">${page.name}</h1>
        <p class="text-muted-foreground">${page.purpose}</p>
      </div>

${componentTags}
    </div>
  </div>
</template>

<script setup lang="ts">
${imports}
</script>`;
  }

  private generateAngularPage(page: { name: string; purpose: string; components: string[] }, _components: UIComponent[]): string {
    const sel = `app-${toKebab(page.name)}`;
    const componentTags = page.components.map((compName) =>
      `<app-${toKebab(compName)}></app-${toKebab(compName)}>`
    ).join('\n        ');

    const className = `${safeIdent(page.name)}PageComponent`;

    return `import { Component } from '@angular/core';

@Component({
  selector: '${sel}',
  template: \`
    <div class="container mx-auto py-6">
      <div class="space-y-6">
        <div>
          <h1 class="text-3xl font-bold">${page.name}</h1>
          <p class="text-muted-foreground">${page.purpose}</p>
        </div>

        ${componentTags}
      </div>
    </div>
  \`
})
export class ${className} {}`;
  }

  private generateRouting(pages: UIPage[], framework: SupportedFramework): string {
    if (framework === 'react') return this.generateReactRouting(pages);
    if (framework === 'vue') return this.generateVueRouting(pages);
    return this.generateAngularRouting(pages);
  }

  private generateReactRouting(pages: UIPage[]): string {
    const first = pages[0];
    const imports = pages.map((p) =>
      `import ${safeIdent(p.name)}Page from '@/pages/${safeIdent(p.name)}Page';`
    ).join('\n');

    const routes = pages.map((p) =>
      `  { path: '${p.path}', element: <${safeIdent(p.name)}Page /> }`
    ).join(',\n');

    const defaultRoute = first ? `{ path: '/', element: <${safeIdent(first.name)}Page /> }` : ``;

    return `import { createBrowserRouter } from 'react-router-dom';
${imports}

export const router = createBrowserRouter([
${defaultRoute ? `  ${defaultRoute},` : ''}
${routes}
]);`;
  }

  private generateVueRouting(pages: UIPage[]): string {
    const first = pages[0];
    const routeDefs = pages.map((p) => `
  {
    path: '${p.path}',
    name: '${safeIdent(p.name)}',
    component: () => import('@/pages/${safeIdent(p.name)}Page.vue')
  }`).join(',');

    const redirect = first ? `{ path: '/', redirect: '${first.path}' }` : '';

    return `import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  ${redirect}${redirect ? ',' : ''}${routeDefs}
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});`;
  }

  private generateAngularRouting(pages: UIPage[]): string {
    const first = pages[0];
    const imports = pages.map((p) =>
      `import { ${safeIdent(p.name)}PageComponent } from './pages/${toKebab(p.name)}.component';`
    ).join('\n');

    const routeDefs = pages.map((p) =>
      `  { path: '${p.path.replace(/^\//, '')}', component: ${safeIdent(p.name)}PageComponent }`
    ).join(',\n');

    const redirect = first
      ? `  { path: '', redirectTo: '${first.path.replace(/^\//, '')}', pathMatch: 'full' },\n`
      : '';

    return `import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
${imports}

const routes: Routes = [
${redirect}${routeDefs}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }`;
  }

  private generatePackageJson(framework: SupportedFramework, _components: UIComponent[]): Record<string, unknown> {
    const deps = {
      react: {
        dependencies: {
          "react": "^18.2.0",
          "react-dom": "^18.2.0",
          "react-router-dom": "^6.26.0",
          "lucide-react": "^0.441.0",
          "clsx": "^2.1.1",
        },
        devDependencies: {
          "@types/node": "^22.0.0",
          "@types/react": "^18.3.3",
          "@types/react-dom": "^18.3.0",
          "@vitejs/plugin-react": "^4.3.1",
          "typescript": "^5.5.4",
          "vite": "^5.4.0",
          "tailwindcss": "^3.4.10",
          "autoprefixer": "^10.4.20",
          "postcss": "^8.4.41",
          "eslint": "^9.9.0",
          "@typescript-eslint/parser": "^8.3.0",
          "@typescript-eslint/eslint-plugin": "^8.3.0"
        },
        main: "src/main.tsx",
        scripts: {
          "dev": "vite",
          "build": "vite build",
          "preview": "vite preview",
          "lint": "eslint \"src/**/*.{ts,tsx}\" --max-warnings=0"
        }
      },
      vue: {
        dependencies: {
          "vue": "^3.4.38",
          "vue-router": "^4.4.5"
        },
        devDependencies: {
          "@types/node": "^22.0.0",
          "@vitejs/plugin-vue": "^5.1.2",
          "typescript": "^5.5.4",
          "vite": "^5.4.0",
          "tailwindcss": "^3.4.10",
          "autoprefixer": "^10.4.20",
          "postcss": "^8.4.41",
          "eslint": "^9.9.0",
          "@typescript-eslint/parser": "^8.3.0",
          "@typescript-eslint/eslint-plugin": "^8.3.0"
        },
        main: "src/main.ts",
        scripts: {
          "dev": "vite",
          "build": "vite build",
          "preview": "vite preview",
          "lint": "eslint \"src/**/*.{ts,vue}\" --max-warnings=0"
        }
      },
      angular: {
        dependencies: {
          "@angular/core": "^17.3.10",
          "@angular/common": "^17.3.10",
          "@angular/router": "^17.3.10",
          "@angular/platform-browser": "^17.3.10",
          "rxjs": "^7.8.1",
          "zone.js": "^0.14.10"
        },
        devDependencies: {
          "typescript": "^5.5.4",
          "@angular/cli": "^17.3.10",
          "@angular-devkit/build-angular": "^17.3.10",
          "tailwindcss": "^3.4.10"
        },
        main: "src/main.ts",
        scripts: {
          "dev": "ng serve",
          "build": "ng build",
          "preview": "ng serve --configuration production"
        }
      }
    } as const;

    const cfg = deps[framework];
    return {
      name: `automation-ui-${framework}`,
      version: "1.0.0",
      description: "Generated automation solution UI",
      type: "module",
      main: cfg.main,
      scripts: cfg.scripts,
      dependencies: cfg.dependencies,
      devDependencies: cfg.devDependencies
    };
  }

  private generateConfigFiles(framework: SupportedFramework): Record<string, string> {
    const configs: Record<string, string> = {};

    // Tailwind config
    configs['tailwind.config.js'] =
`/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  theme: { extend: {} },
  plugins: [],
}`;

    // PostCSS config
    configs['postcss.config.js'] =
`export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;

    if (framework === 'react') {
      configs['vite.config.ts'] =
`import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
})`;

      configs['tsconfig.json'] = JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          skipLibCheck: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
          baseUrl: ".",
          paths: { "@/*": ["./src/*"] }
        },
        include: ["src"],
        references: [{ path: "./tsconfig.node.json" }]
      }, null, 2);

      configs['tsconfig.node.json'] = JSON.stringify({
        compilerOptions: {
          composite: true,
          module: "ESNext",
          moduleResolution: "bundler",
          allowSyntheticDefaultImports: true
        },
        include: ["vite.config.ts"]
      }, null, 2);
    }

    if (framework === 'vue') {
      configs['vite.config.ts'] =
`import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
})`;
    }

    if (framework === 'angular') {
      configs['angular.json'] = JSON.stringify({
        version: 1,
        projects: {
          "automation-ui": {
            projectType: "application",
            root: "",
            sourceRoot: "src",
            prefix: "app",
            architect: {
              build: {
                builder: "@angular-devkit/build-angular:browser",
                options: {
                  outputPath: "dist/automation-ui",
                  index: "src/index.html",
                  main: "src/main.ts",
                  polyfills: [],
                  tsConfig: "tsconfig.app.json",
                  assets: ["src/favicon.ico", "src/assets"],
                  styles: ["src/styles.css"],
                  scripts: []
                }
              }
            }
          }
        }
      }, null, 2);
    }

    return configs;
  }

  private generateDefaultTheme(): UITheme {
    return {
      name: "default",
      colors: {
        primary: "#3b82f6",
        secondary: "#64748b",
        background: "#ffffff",
        text: "#1f2937",
        accent: "#10b981"
      },
      typography: {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: {
          xs: "0.75rem",
          sm: "0.875rem",
          base: "1rem",
          lg: "1.125rem",
          xl: "1.25rem",
          "2xl": "1.5rem",
          "3xl": "1.875rem"
        }
      }
    };
  }

  /* ---------------------------------- Status ---------------------------------- */

  getStatus() {
    return {
      type: "ui-generator",
      name: "UI Generator Agent",
      status: this.status,
      tasksCompleted: this.tasksCompleted,
      capabilities: [
        "react_component_generation",
        "vue_component_generation",
        "angular_component_generation",
        "dashboard_creation",
        "form_generation",
        "routing_setup",
        "theme_application",
        "responsive_design"
      ] as const,
      supportedFrameworks,
      componentTypes: ['dashboard', 'form', 'table', 'chart', 'modal', 'layout'] as const
    };
  }
}

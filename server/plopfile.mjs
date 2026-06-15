/**
 * Plop generators for the backend.
 *
 * Usage (from server/):
 *   npx plop crud-resource                 # interactive
 *   npx plop crud-resource product products  # bypass prompts (name, route)
 *
 * `crud-resource` scaffolds a tenant-scoped route + service + unit test and wires
 * the route into src/index.ts (import, CSRF whitelist, mount) at the plop: anchors.
 * The generated service assumes the Prisma model has `tenantId` + `createdAt` —
 * adjust the fields/Zod schema to match your actual model.
 */
export default function (plop) {
  plop.setGenerator('crud-resource', {
    description: 'Tenant-scoped CRUD route + service + test, wired into index.ts',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Resource name (singular, camelCase) e.g. "product":',
        validate: (v) => (/^[a-zA-Z][a-zA-Z0-9]*$/.test(v) ? true : 'letters/digits only, start with a letter'),
      },
      {
        type: 'input',
        name: 'route',
        message: 'Route path (kebab plural) e.g. "products":',
        validate: (v) => (/^[a-z][a-z0-9-]*$/.test(v) ? true : 'kebab-case only'),
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'src/services/{{camelCase name}}Service.ts',
        templateFile: 'plop-templates/service.hbs',
      },
      {
        type: 'add',
        path: 'src/routes/{{route}}.ts',
        templateFile: 'plop-templates/route.hbs',
      },
      {
        type: 'add',
        path: 'src/__tests__/unit/{{camelCase name}}Service.test.ts',
        templateFile: 'plop-templates/test.hbs',
      },
      {
        type: 'append',
        path: 'src/index.ts',
        pattern: /\/\/ plop:import-route/,
        template: "import {{camelCase name}}Routes from './routes/{{route}}.js';",
      },
      {
        type: 'append',
        path: 'src/index.ts',
        pattern: /\/\/ plop:csrf/,
        template: "v1Router.use('/{{route}}', csrfProtection);",
      },
      {
        type: 'append',
        path: 'src/index.ts',
        pattern: /\/\/ plop:mount/,
        template: "v1Router.use('/{{route}}', {{camelCase name}}Routes);",
      },
    ],
  });
}

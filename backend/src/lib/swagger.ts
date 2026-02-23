/**
 * Configuração OpenAPI/Swagger para documentação da API.
 * Acesse /api-docs em desenvolvimento ou quando DOCS_ENABLED=true
 * Spec em JSON: GET /api-docs.json
 */
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

declare const __dirname: string;
// Em produção (dist) as rotas são .js; em dev (tsx) podem ser .ts
const routesDir = path.join(__dirname, '..', 'routes');

const baseDefinition: swaggerJsdoc.OAS3Definition = {
  openapi: '3.0.0',
  info: {
    title: 'DSICOLA API',
    version: '1.0.0',
    description: 'API do Sistema de Gestão Escolar DSICOLA - Multi-tenant, Secundário e Superior',
  },
  servers: [
    { url: '/', description: 'API relativa à raiz' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

/** Spec mínima caso a geração a partir dos JSDoc falhe (ex.: paths em produção) */
const fallbackSpec: swaggerJsdoc.OAS3Definition = {
  ...baseDefinition,
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['Sistema'],
        security: [],
        responses: { 200: { description: 'API em funcionamento' } },
      },
    },
  },
};

function buildSpec(): swaggerJsdoc.OAS3Definition {
  try {
    const options: swaggerJsdoc.Options = {
      definition: baseDefinition,
      apis: [
        path.join(routesDir, '*.ts'),
        path.join(routesDir, '*.js'),
      ],
    };
    const generated = swaggerJsdoc(options) as swaggerJsdoc.OAS3Definition;
    const hasPaths = generated?.paths && Object.keys(generated.paths).length > 0;
    return hasPaths ? generated : { ...baseDefinition, paths: generated?.paths ?? fallbackSpec.paths };
  } catch (err) {
    console.warn('[OpenAPI] Geração da spec falhou, a usar spec mínima:', (err as Error).message);
    return fallbackSpec;
  }
}

const spec = buildSpec();

export const swaggerUiHandler = swaggerUi.serve;
export const swaggerUiSetup = swaggerUi.setup(spec, {
  swaggerOptions: { persistAuthorization: true },
});
export { spec };

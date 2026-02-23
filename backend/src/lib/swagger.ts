/**
 * Configuração OpenAPI/Swagger para documentação da API.
 * Acesse /api-docs em desenvolvimento ou quando DOCS_ENABLED=true
 */
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.join(__dirname, '..', 'routes');

const options: swaggerJsdoc.Options = {
  definition: {
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
  },
  apis: [path.join(routesDir, '*.ts'), path.join(routesDir, '*.js')],
};

const spec = swaggerJsdoc(options);

export const swaggerUiHandler = swaggerUi.serve;
export const swaggerUiSetup = swaggerUi.setup(spec, {
  swaggerOptions: { persistAuthorization: true },
});
export { spec };

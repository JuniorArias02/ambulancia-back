import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { VariablesEntorno } from './config/variables_entorno.js';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configuracion =
    app.get<ConfigService<VariablesEntorno, true>>(ConfigService);
  const entorno = configuracion.get('NODE_ENV', { infer: true });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  // Necesario para obtener la IP real del cliente detrás de un proxy inverso.
  app.set('trust proxy', 1);
  const origenes = configuracion
    .get('CORS_ORIGENES', { infer: true })
    .split(',')
    .map((origen) => origen.trim());
  // Con '*' no se permiten credenciales: el navegador rechazaría esa combinación.
  const aceptaTodos = origenes.includes('*');
  app.enableCors({
    origin: aceptaTodos ? '*' : origenes,
    credentials: !aceptaTodos,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (entorno !== 'production') {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Ambulancias API')
        .setDescription(
          'API de despacho de ambulancias y atención prehospitalaria',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, documento);
  }

  const puerto = configuracion.get('PUERTO', { infer: true });
  await app.listen(puerto);
  Logger.log(`API escuchando en el puerto ${puerto}`, 'Inicio');
}

await iniciar();

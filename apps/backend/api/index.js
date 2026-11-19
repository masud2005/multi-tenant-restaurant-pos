require('reflect-metadata');

const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { AppModule } = require('../dist/src/app.module');
const { configureApp } = require('../dist/src/configure-app');

let serverPromise;

function getServer() {
  if (!serverPromise) {
    const server = express();
    server.use(express.json({ limit: '10mb' }));
    server.use(express.urlencoded({ limit: '10mb', extended: true }));
    serverPromise = NestFactory.create(AppModule, new ExpressAdapter(server), {
      bodyParser: false,
    })
      .then(async (app) => {
        configureApp(app);
        await app.init();
        return server;
      })
      .catch((error) => {
        serverPromise = undefined;
        throw error;
      });
  }
  return serverPromise;
}

module.exports = (request, response) =>
  new Promise((resolve, reject) => {
    getServer()
      .then((server) => {
        response.on('finish', resolve);
        response.on('close', resolve);
        response.on('error', reject);
        server(request, response);
      })
      .catch(reject);
  });

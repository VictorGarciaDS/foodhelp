import { createApp } from './app';
import { config } from './config';

const app = createApp();
const server = app.listen(config.PORT, '0.0.0.0', () => console.info(`FoodHelp listo en el puerto ${config.PORT}`));
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
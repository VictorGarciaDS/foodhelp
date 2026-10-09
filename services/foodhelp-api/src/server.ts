import { createApp } from './app';
import { config } from './config';

const app = createApp();
app.listen(config.PORT, () => console.info(`FoodHelp listo en el puerto ${config.PORT}`));
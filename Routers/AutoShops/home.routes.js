import express from 'express';

import jwtAuth from '../../middlewares/Auth/auth.middleware.js';
import { getHome } from '../../Controllers/AutoShops/home.controller.js';

const autoShopHomeRouter = express.Router();


autoShopHomeRouter.get("/", jwtAuth, getHome);


export default autoShopHomeRouter;
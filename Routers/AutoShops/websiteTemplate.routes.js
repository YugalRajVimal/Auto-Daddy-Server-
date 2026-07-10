import express from 'express';
import { fetchWebsiteTemplates, selectWebsiteTemplate } from '../../Controllers/AutoShops/websiteTemplate.controller.js';
import jwtAuth from '../../middlewares/Auth/auth.middleware.js';

const websiteTemplateRouter = express.Router();

// GET /api/website-templates
websiteTemplateRouter.get('/', jwtAuth, fetchWebsiteTemplates);

// POST /api/website-templates/select
websiteTemplateRouter.post('/select', jwtAuth, selectWebsiteTemplate);

export default websiteTemplateRouter;
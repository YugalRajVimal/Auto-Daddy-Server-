import express from "express";
import {
  addDomain,
  editDomain,
  getDomains,
  getDomainById,
  deleteDomain,
} from "../../Controllers/Admin/domain.controller.js";

const domainRouter = express.Router();

domainRouter.post("/", addDomain);
domainRouter.get("/", getDomains);
domainRouter.get("/:id", getDomainById);
domainRouter.patch("/:id", editDomain);
domainRouter.delete("/:id", deleteDomain);

export default domainRouter;
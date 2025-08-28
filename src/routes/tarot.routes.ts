import { Router } from "express";
import { getTarotReading } from "../controllers/tarot.controller";

const router = Router();

router.post("/", getTarotReading);

export default router;

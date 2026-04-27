import type { Express, Request, Response } from "express";
import { InvalidStorageKeyError, storage } from "../storage";

export function registerUploadsProxy(app: Express) {
  app.get("/api/uploads/*", async (req: Request, res: Response) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      const file = await storage.get(key);
      if (!file) {
        res.status(404).send("Not found");
        return;
      }
      res.set("Content-Type", file.contentType);
      res.set("Cache-Control", "public, max-age=300");
      res.send(file.data);
    } catch (err) {
      if (err instanceof InvalidStorageKeyError) {
        res.status(400).send("Invalid key");
        return;
      }
      console.error("[Uploads] failed to read:", err);
      res.status(500).send("Storage error");
    }
  });
}

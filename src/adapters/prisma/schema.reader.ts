import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { ModelDefinition, ModelField } from "../../types/adapter.types";

export class SchemaReader {
  private schemaPath: string;

  constructor(schemaPath?: string) {
    this.schemaPath =
      schemaPath ?? join(process.cwd(), "prisma", "schema.prisma");
  }

  read(): ModelDefinition[] {
    if (!existsSync(this.schemaPath)) {
      throw new Error(`Prisma schema not found at: ${this.schemaPath}`);
    }

    const content = readFileSync(this.schemaPath, "utf-8");
    return this.parse(content);
  }

  private parse(content: string): ModelDefinition[] {
    const models: ModelDefinition[] = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;

    let match;
    while ((match = modelRegex.exec(content)) !== null) {
      const modelName = match[1];
      const modelBody = match[2];
      if (!modelName || !modelBody) continue;
      const fields = this.parseFields(modelBody);

      models.push({
        name: modelName,
        fields,
      });
    }

    return models;
  }

  private parseFields(body: string): ModelField[] {
    const fields: ModelField[] = [];
    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      // Skip directives and empty lines
      if (line.startsWith("@@") || line.startsWith("//")) continue;

      const field = this.parseLine(line);
      if (field) fields.push(field);
    }

    return fields;
  }

  private parseLine(line: string): ModelField | null {
    const parts = line.split(/\s+/);
    if (parts.length < 2) return null;

    const name = parts[0];
    const rawType = parts[1];

    if (!name || !rawType) return null;
    if (rawType.startsWith("@@")) return null;

    const isRequired = !rawType.includes("?") && !rawType.includes("[]");
    const isArray = rawType.includes("[]");
    const type = rawType.replace("?", "").replace("[]", "");

    const isId = line.includes("@id");
    const isUnique = line.includes("@unique");
    const hasDefault = line.includes("@default");

    let defaultValue: unknown = undefined;
    if (hasDefault) {
      const defaultMatch = line.match(/@default\(([^)]+)\)/);
      if (defaultMatch) {
        defaultValue = defaultMatch[1];
      }
    }

    return {
      name,
      type: isArray ? `${type}[]` : type,
      isRequired,
      isId,
      isUnique,
      default: defaultValue,
    };
  }
}

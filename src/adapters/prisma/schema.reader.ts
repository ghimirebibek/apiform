import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type {
  EnumDefinition,
  ModelDefinition,
  ModelField,
  SchemaDefinition,
} from "../../types/adapter.types";

export class SchemaReader {
  private schemaPath: string;

  constructor(schemaPath?: string) {
    this.schemaPath =
      schemaPath ?? join(process.cwd(), "prisma", "schema.prisma");
  }

  read(): SchemaDefinition {
    if (!existsSync(this.schemaPath)) {
      throw new Error(`Prisma schema not found at: ${this.schemaPath}`);
    }

    const content = readFileSync(this.schemaPath, "utf-8");
    return this.parse(content);
  }

  private parse(content: string): SchemaDefinition {
    const stripped = SchemaReader.stripBlockComments(content);

    const models: ModelDefinition[] = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;

    let match;
    while ((match = modelRegex.exec(stripped)) !== null) {
      const modelName = match[1];
      const modelBody = match[2];
      if (!modelName || !modelBody) continue;
      const fields = this.parseFields(modelBody);

      models.push({
        name: modelName,
        fields,
      });
    }

    const enums: EnumDefinition[] = [];
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;

    while ((match = enumRegex.exec(stripped)) !== null) {
      const enumName = match[1];
      const enumBody = match[2];
      if (!enumName || !enumBody) continue;

      enums.push({
        name: enumName,
        values: this.parseEnumValues(enumBody),
      });
    }

    return { models, enums };
  }

  // Prisma block comments (/* ... */) can appear anywhere, including mid
  // model, and would otherwise corrupt the naive line-based field parsing.
  private static stripBlockComments(content: string): string {
    return content.replace(/\/\*[\s\S]*?\*\//g, "");
  }

  private parseEnumValues(body: string): string[] {
    return body
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !l.startsWith("@@") && !l.startsWith("//"))
      .map((l) => l.split(/\s+/)[0])
      .filter((v): v is string => Boolean(v));
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

  private parseLine(rawLine: string): ModelField | null {
    // Strip a trailing line comment so it can't be mistaken for an
    // attribute (e.g. `age Int // uses @default in the future`).
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!line) return null;

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
    const isUpdatedAt = line.includes("@updatedAt");
    const hasDefault = line.includes("@default");

    let defaultValue: unknown = undefined;
    if (hasDefault) {
      // Allows one level of nested parens so zero-arg default functions
      // like now()/autoincrement()/uuid()/cuid() are captured in full
      // instead of being truncated at their own inner ")".
      const defaultMatch = line.match(/@default\(((?:[^()]|\([^()]*\))*)\)/);
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
      isUpdatedAt,
      default: defaultValue,
    };
  }
}

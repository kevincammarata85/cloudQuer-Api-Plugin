import axios from "axios";
import fs from "fs/promises";
import sqlite3 from "sqlite3";
import type { DataType } from "@cloudquery/plugin-sdk-javascript/arrow";
import { Utf8, Int64, Float64 } from "@cloudquery/plugin-sdk-javascript/arrow";
import type {
  Column,
  ColumnResolver,
} from "@cloudquery/plugin-sdk-javascript/schema/column";
import type {
  Table,
  TableResolver,
} from "@cloudquery/plugin-sdk-javascript/schema/table";
import { createTable } from "@cloudquery/plugin-sdk-javascript/schema/table";
import pMap from "p-map";
import type { Logger } from "winston";
import type { Spec } from "./spec.js";

const getColumnResolver = (c: string): ColumnResolver => {
  return (meta, resource) => {
    const dataItem = resource.getItem();
    resource.setColumData(c, (dataItem as Record<string, unknown>)[c]);
    return Promise.resolve();
  };
};

const db = new sqlite3.Database("./database.db");

const getColumnType = (value: unknown): DataType => {
  const number = Number(value);
  if (Number.isNaN(number)) return new Utf8();
  if (Number.isInteger(number)) return new Int64();
  return new Float64();
};

const extractVulnerabilityData = (
  vuln: Record<string, any>,
): Record<string, unknown> => {
  return {
    id: vuln.cve.id,
    sourceIdentifier: vuln.cve.sourceIdentifier,
    published: vuln.cve.published,
    lastModified: vuln.cve.lastModified,
    vulnStatus: vuln.cve.vulnStatus,
    description:
      vuln.cve.descriptions?.find((desc: any) => desc.lang === "en")?.value ||
      "",
    cvssBaseScore:
      vuln.cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore || null,
    cvssSeverity: vuln.cve.metrics?.cvssMetricV2?.[0]?.baseSeverity || "",
    configurations: JSON.stringify(vuln.cve.configurations) || "[]",
    references: JSON.stringify(vuln.cve.references) || "[]",
  };
};

const getTable = async (
  rows: Record<string, unknown>[],
  tableName: string,
): Promise<Table> => {
  if (rows.length === 0) {
    throw new Error("No rows found");
  }
  const columnNames = Object.keys(rows[0]);
  const columnTypes = Object.values(rows[0]).map((value) =>
    getColumnType(value),
  );

  const columnDefinitions: Column[] = columnNames.map((c, index) => ({
    name: c,
    type: columnTypes[index],
    description: "",
    primaryKey: false,
    notNull: false,
    incrementalKey: false,
    unique: false,
    ignoreInTests: false,
    resolver: getColumnResolver(c),
  }));

  const tableResolver: TableResolver = (clientMeta, parent, stream) => {
    for (const r of rows) stream.write(r);
    return Promise.resolve();
  };
  return createTable({
    name: tableName,
    columns: columnDefinitions,
    resolver: tableResolver,
  });
};

const fetchDataFromApi = async (
  url: string,
): Promise<Record<string, unknown>[]> => {
  const response = await axios.get(url);
  const vulnerabilities = response.data.vulnerabilities;
  if (!vulnerabilities) {
    throw new Error("No vulnerabilities data found in response");
  }
  return vulnerabilities.map(extractVulnerabilityData);
};

const readStartIndex = async () => {
  try {
    const data = await fs.readFile("startIndex.txt", "utf-8");
    return parseInt(data);
  } catch (error) {
    return 1; // Default start index if file doesn't exist
  }
};

const writeStartIndex = async (startIndex: any) => {
  await fs.writeFile("startIndex.txt", startIndex.toString());
};

export const getTables = async (
  logger: Logger,
  spec: Spec,
): Promise<Table[]> => {
  const { apiEndpoints, concurrency } = spec;
  let startIndex = await readStartIndex(); // Read startIndex from file
  const allTables = await pMap(
    apiEndpoints,
    async (endpoint) => {
      const url = `${endpoint.url}?resultsPerPage=100&startIndex=${startIndex}`;
      const data = await fetchDataFromApi(url);
      await writeStartIndex(startIndex + 1); // Write updated startIndex to file
      return getTable(data, endpoint.name);
    },
    { concurrency },
  );

  return allTables;
};

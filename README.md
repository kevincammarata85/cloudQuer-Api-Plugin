# CloudQuery TS/Node Js Source Plugin

# Description :
  I implemented a solution where SQLite3 is utilized as the destination for storing data. The system manages the last inserted data by incorporating API pagination. Upon following the provided instructions to execute the plugin, you will discover a file named `db.sql`. Inside this file, there exists a table named `vulnerabilities`, which you can access and inspect within your database environment. This approach ensures that data is stored efficiently in SQLite3, with pagination controls in place to handle large datasets retrieved from APIs.

# plugin configuration for source

```yaml
kind: source
spec:
  name: "api-source"
  registry: "grpc"
  path: "localhost:7777"
  version: "v1.0.0"
  tables: ["*"]
  destinations:
    - "sqlite"
  backend_options:
    table_name: "vulnerabilities"
    connection: "./db.sql"
  spec:
    apiEndpoints:
      - name: "vulnerabilities"
        url: "https://services.nvd.nist.gov/rest/json/cves/2.0"
    concurrency: 5
```

## Getting started

Install dependencies

```shell
npm install
```

Run the plugin locally

```shell
npm run dev
```

Run cloudquery

```shell
cloudquery sync sync.yml
```

This will create db.sql file (a Sqlite database) with a table `vulnerabilities` and two records.

## Building and publishing the plugin

Use the following command to build a container with the plugin:

```shell
npm run package:container
```
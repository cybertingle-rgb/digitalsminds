import { describe, expect, it } from "vitest";
import { CONNECTION_INIT_SQL, connectionConfig } from "./db-config";

describe("connectionConfig", () => {
  it("reads a Hostinger-style URL, including special characters in the password", () => {
    expect(connectionConfig("mysql://u107_user:p%40ss%3Aw%2Frd@localhost:3306/u107_db")).toEqual({
      host: "localhost",
      port: 3306,
      user: "u107_user",
      password: "p@ss:w/rd",
      database: "u107_db",
      initSql: CONNECTION_INIT_SQL,
    });
  });

  it("keeps extra driver options and defaults the port", () => {
    expect(connectionConfig("mariadb://a:b@db.example/x?connectionLimit=5&ssl=true")).toMatchObject({ port: 3306, connectionLimit: 5, ssl: true });
  });
});

// Integration tests run against a separate database. Never point this at real data.
import "dotenv/config";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is not set");
if (!/_test(\?|$)/.test(testUrl)) throw new Error("TEST_DATABASE_URL must name a *_test database");
process.env.DATABASE_URL = testUrl;

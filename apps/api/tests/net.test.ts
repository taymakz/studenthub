import { createServer } from "node:http";
import { describe, it, expect } from "vitest";

import {
  fetchUrlBytesLimited,
  ipIsPrivate,
} from "../src/lib/net.ts";

describe("ipIsPrivate", () => {
  it.each([
    ["127.0.0.1", true],
    ["10.1.2.3", true],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["192.168.1.1", true],
    ["169.254.169.254", true], // cloud metadata
    ["0.0.0.0", true],
    ["224.0.0.1", true],
    ["::1", true],
    ["fe80::1", true],
    ["fc00::1", true],
    ["::ffff:127.0.0.1", true],
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["172.15.0.1", false],
    ["172.32.0.1", false],
    ["::ffff:8.8.8.8", false],
  ])("%s -> %s", (ip, expected) => {
    expect(ipIsPrivate(ip)).toBe(expected);
  });
});

describe("fetchUrlBytesLimited", () => {
  it("rejects non-http protocols without network", async () => {
    await expect(fetchUrlBytesLimited("ftp://example.com/f")).rejects.toThrow();
    await expect(
      fetchUrlBytesLimited("file:///etc/passwd")
    ).rejects.toThrow();
  });

  it("rejects loopback hosts", async () => {
    await expect(
      fetchUrlBytesLimited("http://127.0.0.1:9/f", { timeoutMs: 2000 })
    ).rejects.toThrow("مجاز نیست");
  });

  it("follows redirects and enforces caps (lookup stubbed, local server)", async () => {
    const server = createServer((req, res) => {
      if (req.url === "/redir") {
        res.writeHead(302, { location: "/file" }).end();
        return;
      }
      if (req.url === "/big") {
        res.writeHead(200, { "content-length": "99999999" }).end("x");
        return;
      }
      res.writeHead(200, { "content-type": "video/mp4" }).end("0123456789");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    // Pretend DNS says public; the actual socket still goes to localhost.
    const lookup = async () => ["93.184.216.0"];
    try {
      const ok = await fetchUrlBytesLimited(`http://127.0.0.1:${port}/redir`, {
        timeoutMs: 5000,
        lookup,
      });
      expect(ok.bytes.toString()).toBe("0123456789");
      expect(ok.contentType).toBe("video/mp4");
      await expect(
        fetchUrlBytesLimited(`http://127.0.0.1:${port}/big`, {
          timeoutMs: 5000,
          lookup,
        })
      ).rejects.toThrow("حد مجاز");
    } finally {
      server.close();
    }
  });
});

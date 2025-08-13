#!/usr/bin/env npx tsx

/**
 * MCP Integration Example
 *
 * Shows how to integrate MCP servers with lemmy-tools
 * Run with: npx tsx examples/03-mcp-integration.ts
 *
 * Prerequisites:
 * - npm install @modelcontextprotocol/server-filesystem
 * - npm install @modelcontextprotocol/server-puppeteer
 */

import { createAnthropicClient, createContext } from "@mariozechner/lemmy";
import { MCPRegistry } from "@mariozechner/lemmy-tools/mcp";
import { bashTool, readTool } from "@mariozechner/lemmy-tools/builtin";

async function main() {
	console.log("🌐 Setting up lemmy with MCP integration...");

	const client = createAnthropicClient({ model: "claude-3-5-sonnet-20241022" });
	const context = createContext();

	// Add essential built-in tools first
	console.log("📦 Adding essential built-in tools...");
	context.addTool(bashTool);
	context.addTool(readTool);
	console.log("  - Bash: Shell command execution");
	console.log("  - Read: File reading capabilities");

	// Setup MCP servers
	console.log("\n🌍 Setting up MCP servers...");
	const mcpRegistry = new MCPRegistry();

	try {
		// Add filesystem MCP server
		console.log("  📁 Registering filesystem server...");
		await mcpRegistry.registerServer("filesystem", {
			command: "npx",
			args: ["@modelcontextprotocol/server-filesystem", process.cwd()],
			timeout: 10000,
		});
		console.log("    ✅ Filesystem server registered");

		// Add puppeteer MCP server (if available)
		console.log("  🌍 Registering puppeteer server...");
		await mcpRegistry.registerServer("puppeteer", {
			command: "npx",
			args: ["@modelcontextprotocol/server-puppeteer"],
			timeout: 30000,
		});
		console.log("    ✅ Puppeteer server registered");

		// Get MCP tools and add to context
		console.log("\n🔧 Loading MCP tools...");
		const mcpTools = await mcpRegistry.getAvailableTools();

		mcpTools.forEach((tool) => {
			console.log(`  - ${tool.name}: ${tool.description.slice(0, 50)}...`);
			context.addTool(tool);
		});

		console.log(`\n🎉 Total tools available: ${mcpTools.length + 2}`);

		// Test MCP functionality
		console.log("\n🧪 Testing MCP tools...");

		const result = await client.ask(
			"List the files in the current directory using MCP tools, then take a screenshot of a simple webpage",
			{ context },
		);

		if (result.type === "success") {
			console.log("✅ MCP integration working!");
			console.log("Response:", result.message.content?.slice(0, 400) + "...");

			if (result.message.toolCalls) {
				console.log(`🔧 Tools used: ${result.message.toolCalls.map((tc) => tc.name).join(", ")}`);
			}
		} else {
			console.log("❌ Error:", result.error.message);
		}
	} catch (error) {
		console.error("💥 MCP setup failed:", error);
		console.log("\n📝 Make sure MCP servers are installed:");
		console.log("  npm install @modelcontextprotocol/server-filesystem");
		console.log("  npm install @modelcontextprotocol/server-puppeteer");
	} finally {
		// Cleanup
		console.log("\n🧹 Shutting down MCP servers...");
		await mcpRegistry.shutdown();
		console.log("✅ Cleanup completed");
	}
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
	main().catch(console.error);
}

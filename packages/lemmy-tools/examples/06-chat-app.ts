#!/usr/bin/env npx tsx

/**
 * Chat Application Example
 *
 * Shows how to build a simple chat app with lemmy-tools
 * Run with: npx tsx examples/06-chat-app.ts
 */

import { createAnthropicClient, createContext } from "@mariozechner/lemmy";
import { getBuiltinTools, MCPRegistry } from "@mariozechner/lemmy-tools";
import * as readline from "readline";

class ChatApp {
	private client = createAnthropicClient({ model: "claude-3-5-sonnet-20241022" });
	private context = createContext();
	private abortController?: AbortController;
	private mcpRegistry = new MCPRegistry();
	private rl: readline.Interface;

	constructor() {
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
	}

	async initialize() {
		console.log("🚀 Initializing Chat App with lemmy-tools...");

		// Add all built-in tools
		console.log("📦 Loading built-in tools...");
		const tools = getBuiltinTools();
		tools.forEach((tool) => {
			console.log(`  - ${tool.name}: ${tool.category}`);
			this.context.addTool(tool);
		});

		// Setup MCP servers (optional - only if available)
		try {
			console.log("\n🌍 Setting up MCP servers...");

			// Try to add filesystem server
			try {
				await this.mcpRegistry.registerServer("filesystem", {
					command: "npx",
					args: ["@modelcontextprotocol/server-filesystem", process.cwd()],
					timeout: 10000,
				});
				console.log("  ✅ Filesystem MCP server registered");
			} catch (error) {
				console.log("  ⚠️ Filesystem MCP server not available");
			}

			// Get any available MCP tools
			const mcpTools = await this.mcpRegistry.getAvailableTools();
			mcpTools.forEach((tool) => {
				console.log(`  - ${tool.name}: MCP tool`);
				this.context.addTool(tool);
			});

			if (mcpTools.length === 0) {
				console.log("  📝 No MCP servers available (install with: npm install @modelcontextprotocol/server-*)");
			}
		} catch (error) {
			console.log("  ⚠️ MCP setup failed, continuing with built-in tools only");
		}

		console.log(`\n🎉 Chat app ready! Total tools: ${this.context.listTools().length}`);
	}

	async sendMessage(message: string): Promise<string> {
		this.abortController = new AbortController();

		try {
			console.log("\n🤖 Assistant is thinking...");
			const startTime = Date.now();

			const result = await this.client.ask(message, {
				context: this.context,
				signal: this.abortController.signal,
			});

			const duration = Date.now() - startTime;

			if (result.type === "success") {
				console.log(`⏱️ Response took ${duration}ms`);

				if (result.message.toolCalls && result.message.toolCalls.length > 0) {
					console.log(`🔧 Tools used: ${result.message.toolCalls.map((tc) => tc.name).join(", ")}`);
				}

				return result.message.content || "No response content";
			} else {
				return `Error: ${result.error.message}`;
			}
		} catch (error) {
			if (error.name === "AbortError") {
				return "Operation cancelled by user";
			}
			throw error;
		}
	}

	cancelCurrentOperation() {
		console.log("\n🚫 Cancelling current operation...");
		this.abortController?.abort();
	}

	async startChat() {
		console.log("\n💬 Starting chat session...");
		console.log("📝 Type your messages below. Commands:");
		console.log("  - /cancel: Cancel current operation");
		console.log("  - /tools: List available tools");
		console.log("  - /clear: Clear conversation history");
		console.log("  - /quit: Exit the chat");
		console.log("\n" + "=".repeat(50));

		while (true) {
			try {
				const userInput = await this.getUserInput("\n🗨️ You: ");

				// Handle commands
				if (userInput.startsWith("/")) {
					const command = userInput.slice(1).toLowerCase();

					switch (command) {
						case "quit":
						case "exit":
							console.log("\n👋 Goodbye!");
							return;

						case "cancel":
							this.cancelCurrentOperation();
							continue;

						case "tools":
							const tools = this.context.listTools();
							console.log(`\n🔧 Available tools (${tools.length}):`);
							tools.forEach((tool) => {
								console.log(`  - ${tool.name}: ${tool.description.slice(0, 60)}...`);
							});
							continue;

						case "clear":
							this.context.clear();
							console.log("🧹 Conversation history cleared");
							continue;

						default:
							console.log("⚠️ Unknown command. Available: /cancel, /tools, /clear, /quit");
							continue;
					}
				}

				if (userInput.trim() === "") {
					continue;
				}

				// Send message to assistant
				const response = await this.sendMessage(userInput);
				console.log(`\n🤖 Assistant: ${response}`);
			} catch (error) {
				console.error("\n💥 Unexpected error:", error.message);
			}
		}
	}

	private getUserInput(prompt: string): Promise<string> {
		return new Promise((resolve) => {
			this.rl.question(prompt, (answer) => {
				resolve(answer);
			});
		});
	}

	async shutdown() {
		console.log("\n🧹 Shutting down...");
		this.rl.close();
		await this.mcpRegistry.shutdown();
		console.log("✅ Cleanup completed");
	}
}

async function main() {
	const app = new ChatApp();

	// Handle graceful shutdown
	process.on("SIGINT", async () => {
		console.log("\n\n⚠️ Received interrupt signal...");
		await app.shutdown();
		process.exit(0);
	});

	try {
		await app.initialize();
		await app.startChat();
	} catch (error) {
		console.error("💥 Fatal error:", error);
	} finally {
		await app.shutdown();
	}
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
	main().catch(console.error);
}

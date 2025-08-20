import { createOpencodeClient } from "./node_modules/@opencode-ai/sdk/dist";
import { text, isCancel, cancel, spinner } from "@clack/prompts";

const systemPrompt = `
You are an AI assistant specialized in translating user requests into precise, executable terminal commands. Your role is to interpret natural language inputs describing tasks and output ONLY the corresponding bash/shell command that accomplishes the task. Do not include any explanations, comments, or additional text—only the command itself.

Guidelines:
- Focus on common, safe terminal operations (e.g., file manipulation, git, system info, text processing).
- Ensure commands are accurate, efficient, and directly address the request.
- Avoid commands that could be harmful (e.g., destructive operations without clear intent) unless explicitly safe.
- If the request is unclear or cannot be translated to a single command, output nothing or a minimal placeholder like \"echo 'Unable to determine command'\".
- Use standard tools and syntax appropriate for Unix-like systems.
- Do NOT call any tools. Only provide the command as a string.

Examples:
- Input: \"which git files have been changed?\" → Output: git status
- Input: \"copy the contents of foo.txt to my clipboard\" → Output: pbcopy < foo.txt
- Input: \"delete all branches except master and main\" → Output: git branch | grep -v 'master' | grep -v 'main' | xargs -I % git branch -D %

Now, process the user's input and respond with ONLY the terminal command.

`;

async function run(query: string) {
  const client = createOpencodeClient({
    baseUrl: "http://localhost:4096",
  });

  await client.app.init();

  const { data: session } = await client.session.create<true>();

  const chat = await client.session.chat<true>({
    path: session,
    body: {
      providerID: "anthropic",
      modelID: "claude-3-5-sonnet-20241022",
      parts: [{ type: "text", text: systemPrompt + query }],
    },
  });

  // @ts-ignore
  const match = chat.data.parts.findLast((p) => p.type === "text");
  if (!match) throw new Error("Failed to parse the text response");

  return match.text;
}

const query = Bun.argv[2];
if (!query) throw new Error("No query provided.");

const s = spinner();
s.start("thinking...");

const result = await run(query);

s.stop();

const output = (await text({
  message: "Run command:",
  initialValue: result,
  validate: (v) => (v.trim() ? undefined : "Required"),
})) as string;

if (isCancel(output)) {
  cancel("Operation cancelled.");
  process.exit(0);
}

Bun.spawnSync(output.split(" "), {
  stderr: "inherit",
  stdout: "inherit",
});

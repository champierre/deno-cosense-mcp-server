import { Server } from "npm:@modelcontextprotocol/sdk@1.5.0/server/index.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk@1.5.0/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolRequest,
} from "npm:@modelcontextprotocol/sdk@1.5.0/types.js";
import { cosenseSyntaxRules } from "./cosense_syntax_rules.ts";

const COSENSE_BASE = "https://scrapbox.io";
const COSENSE_API_BASE = "https://scrapbox.io/api/pages";
const USER_AGENT = "cosense-mcp-server/1.0";

// Validate environment variables
const PROJECT_NAME = Deno.env.get("COSENSE_PROJECT_NAME");
const SERVICE_ACCOUNT_ACCESS_KEY = Deno.env.get("COSENSE_SERVICE_ACCOUNT_ACCESS_KEY");
if (!PROJECT_NAME || PROJECT_NAME === '') {
  console.error("Environment variable COSENSE_PROJECT_NAME is not set.");
  Deno.exit(1);
}
if (!SERVICE_ACCOUNT_ACCESS_KEY || SERVICE_ACCOUNT_ACCESS_KEY === '') {
  console.error("Environment variable COSENSE_SERVICE_ACCOUNT_ACCESS_KEY is not set.");
  Deno.exit(1);
}

const TOOLS: Tool[] = [
  {
    name: "cosense_search",
    description: "Search Cosense by keywords",
    inputSchema: {
      type: "object",
      properties: {
        keywords: { type: "string", descrption: "Keywords separated by spaces" },
      },
      required: ["keywords"]
    },
  },
  {
    name: "cosense_get_page",
    description: "Get a page by title",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", descrption: "Title of the page" },
      },
      required: ["title"]
    }
  },
  {
    name: "cosense_syntax_rule",
    description: "Get Cosense syntax rules",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  }
];
const server = new Server(
  {
    name: "cosense-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {
        cosense_search: TOOLS[0],
        cosense_get_page: TOOLS[1],
        cosense_syntax_rule: TOOLS[2]
      },
    },
  }
);

// Helper function to generate page URL
function getPageUrl(title: string): string {
  return `${COSENSE_BASE}/${PROJECT_NAME}/${encodeURIComponent(title)}`;
}

async function makeRequest<T>(url: string): Promise<T | Error> {
  const headers: Record<string, string> = {
    "x-service-account-access-key": SERVICE_ACCOUNT_ACCESS_KEY || "",
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

// API response types

interface RelatedPage {
  id: string;
  title: string;
  titleLc: string;
  image: string | null;
  descriptions: string[];
  linksLc: string[];
  linked: number;
  pageRank: number;
  infoboxDisableLinks: string[];
  created: number;
  updated: number;
  accessed: number;
  lastAccessed: number;
}

interface PageContentResponse {
  id: string;
  title: string;
  created: number;
  updated: number;
  image?: string;
  descriptions: string[];
  lines: string[];
  relatedPages: {
    links1hop: RelatedPage[];
    links2hop: RelatedPage[];
  };
}

interface SearchResponse {
  projectName: string;
  searchQuery: string;
  limit: number;
  count: number;
  pages: Array<{
    id: string;
    title: string;
    image?: string;
    words?: string[];
    lines?: string[];
  }>;
}

server.setRequestHandler(ListResourcesRequestSchema, () => ({
  resources: [],
}));

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};
  switch (name) {
    case "cosense_syntax_rule":
      return {
        content: [
          {
            type: "text",
            text: cosenseSyntaxRules,
          },
        ],
        isError: false
      };
      break;
    case "cosense_search":
      const keywords = args.keywords as string;
      if (typeof keywords !== "string") {
        return {
          content: [
            {
              type: "text",
              text: `Keywords should be strings separated by spaces, got ${typeof keywords}`,
            },
          ],
          isError: true,
        };
      }

      const encodedKeywords = encodeURIComponent(keywords);
      const searchUrl = `${COSENSE_API_BASE}/${PROJECT_NAME}/search/query?q=${encodedKeywords}`;
      const searchResponse = await makeRequest<SearchResponse>(searchUrl);

      if (searchResponse instanceof Error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${searchResponse.message}`,
            },
          ],
          isError: true
        };
      }

      if (searchResponse.count === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No results for "${keywords}"`,
            },
          ],
          isError: true
        };
      }
  
      const results = {
        projectName: searchResponse.projectName,
        searchQuery: searchResponse.searchQuery,
        limit: searchResponse.limit,
        count: searchResponse.count,
        pages: searchResponse.pages.map(page => ({
          id: page.id,
          title: page.title,
          image: page.image,
          words: page.words,
          lines: page.lines,
          url: getPageUrl(page.title)
        }))
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
        isError: false
      };
      break;
    case "cosense_get_page": 
      const title = args.title as string;
      const encodedTitle = encodeURIComponent(title);
      const pageUrl = `${COSENSE_API_BASE}/${PROJECT_NAME}/${encodedTitle}`;
      const getPageResponse = await makeRequest<PageContentResponse>(pageUrl);
  
      if (getPageResponse instanceof Error) {
        // Check if it's a 404 error
        if ((getPageResponse as any).statusCode === 404) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Page "${title}" does not exist.`,
              },
            ],
            isError: true
          };
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Error: ${getPageResponse.message}`,
            },
          ],
          isError: true
        };
      }
  
      const result = {
        id: getPageResponse.id,
        title: getPageResponse.title,
        created: getPageResponse.created,
        updated: getPageResponse.updated,
        image: getPageResponse.image,
        descriptions: getPageResponse.descriptions,
        lines: getPageResponse.lines,
        url: getPageUrl(getPageResponse.title),
        // relatedPages: {
        //   links1hop: getPageResponse.relatedPages.links1hop.map(page => ({
        //     ...page,
        //     url: getPageUrl(page.title)
        //   })),
        //   links2hop: getPageResponse.relatedPages.links2hop.map(page => ({
        //     ...page,
        //     url: getPageUrl(page.title)
        //   }))
        // }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          },
        ]
      };
      break;
    default:
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}`
          },
        ],
        isError: true,
      };
      break;
  }
});

await server.connect(new StdioServerTransport());
console.error("MCP server running on stdio");

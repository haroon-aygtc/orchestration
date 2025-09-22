// Real PostgreSQL Retriever Implementation
import { PostgreSQLTaskStore } from "../database/postgresql-client";
import type { Retriever, RetrieverResultItem } from "../agents/shared/types";
import { TaskStatus } from "../agents/shared/types";

const prisma = new PostgreSQLTaskStore();

export class PostgresRetriever implements Retriever {
  async search(
    query: string, 
    sources?: string[], 
    filters?: Record<string, any>
  ): Promise<RetrieverResultItem[]> {
    const results: RetrieverResultItem[] = [];
    
    try {
      // Search in different entities based on sources
      const searchSources = sources || ["vendors", "documents", "rfqs"];
      
      for (const source of searchSources) {
        switch (source.toLowerCase()) {
          case "vendors":
            const vendors = await this.searchVendors(query, filters);
            results.push(...vendors);
            break;
            
          case "documents":
            const docs = await this.searchDocuments(query, filters);
            results.push(...docs);
            break;
            
          case "rfqs":
            const rfqs = await this.searchRFQs(query, filters);
            results.push(...rfqs);
            break;
            
          case "tasks":
            const tasks = await this.searchTasks(query, filters);
            results.push(...tasks);
            break;
        }
      }
      
      // Sort by relevance score (descending)
      return results.sort((a, b) => b.relevanceScore ? b.relevanceScore - (a.relevanceScore ?? 0) : 0);
      
    } catch (error) {
      console.error("PostgresRetriever search failed:", error);
      return [];
    }
  }
 
  private async searchVendors(query: string, filters?: Record<string, any>): Promise<RetrieverResultItem[]> {
    const vendors = await prisma.list({
      status: "pending" as TaskStatus,
      limit: 20,
      ...filters
    });
    return vendors.map((task: any) => ({
      source: "tasks",
      content: `Task: ${task.type}`,
      relevanceScore: this.calculateRelevance(query, task.type),
      metadata: {
        id: task.id,
        type: task.type,
        status: task.status,
        createdAt: task.createdAt
      }
    }));
  }
  
  private async searchDocuments(query: string, filters?: Record<string, any>): Promise<RetrieverResultItem[]> {
    const documents = await prisma.list({
      status: "pending" as TaskStatus,
      limit: 20,
      ...filters
    });
    
    return documents.map((doc: any) => ({
      source: "tasks",
      content: `Artifact: ${doc.kind} by ${doc.by}`,
      relevanceScore: this.calculateRelevance(query, doc.kind + " " + doc.by),
      metadata: {
        id: doc.id,
        kind: doc.kind,
        by: doc.by,
        agentId: doc.agentId,
        createdAt: doc.createdAt
      }
    }));
  }
  
  private async searchRFQs(query: string, filters?: Record<string, any>): Promise<RetrieverResultItem[]> {
    const goals = await prisma.list({
      status: "pending" as TaskStatus,
      limit: 20,
      ...filters
    });

    return goals.map((goal: any) => ({
      source: "tasks",
      content: `${goal.title}: ${goal.description || "No description"}`,
      relevanceScore: this.calculateRelevance(query, goal.title + " " + (goal.description || "")),
      metadata: {
        id: goal.id,
        agentId: goal.agentId,
        createdAt: goal.createdAt
      }
    }));
  }
    
   
  
  private async searchTasks(query: string, filters?: Record<string, any>): Promise<RetrieverResultItem[]> {
    const tasks = await prisma.list({
      status: "pending" as TaskStatus,
      limit: 20,
      ...filters
    });
    
    return tasks.map((task: any) => ({
      source: "tasks",
      content: `Task ${task.type}: ${JSON.stringify(task.input).substring(0, 200)}`,
      relevanceScore: this.calculateRelevance(query, task.type + " " + JSON.stringify(task.input)),
      metadata: {
        id: task.id,
        type: task.type,
        status: task.status,
        createdAt: task.createdAt
      }
    }));

  }
  
  private calculateRelevance(query: string, content: string): number {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Simple relevance scoring
    let score = 0;
    
    // Exact match gets highest score
    if (contentLower.includes(queryLower)) {
      score += 1.0;
    }
    
    // Word matches
    const queryWords = queryLower.split(/\s+/);
    const contentWords = contentLower.split(/\s+/);
    
    for (const queryWord of queryWords) {
      if (queryWord.length > 2) { // Skip very short words
        for (const contentWord of contentWords) {
          if (contentWord.includes(queryWord)) {
            score += 0.5;
          }
        }
      }
    }
    
    // Normalize score to 0-1 range
    return Math.min(score / queryWords.length, 1.0);
  }
}

export const createPostgresRetriever = (): Retriever => {
  return new PostgresRetriever();
};

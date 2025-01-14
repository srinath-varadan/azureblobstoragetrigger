const { app, input, output } = require("@azure/functions");
const { v4: uuidv4 } = require("uuid");
const { ApiKeyCredentials } = require("@azure/ms-rest-js");
const sleep = require("util").promisify(setTimeout);
const {
  DocumentAnalysisClient,
  AzureKeyCredential,
} = require("@azure/ai-form-recognizer");
const {
  TextAnalysisClient,
  AzureKeyCredential: nerAzureKeyCredential,
} = require("@azure/ai-language-text");

const fs = require("fs");

async function analyzeDocument(blob) {
  const endpoint = "";
  const apiKey = "";
  const modelId = "prebuilt-read";
  const client = new DocumentAnalysisClient(
    endpoint,
    new AzureKeyCredential(apiKey)
  );
  const poller = await client.beginAnalyzeDocument(modelId, blob);
  const { content, pages, languages } = await poller.pollUntilDone();
  let pageContent = "";
  if (!pages || pages.length <= 0) {
    console.log("No pages were extracted from the document.");
  } else {
    console.log("Pages:");
    for (const page of pages) {
      if (page.lines && page.lines.length > 0) {
        console.log("  Lines:");
        for (const line of page.lines) {
          pageContent += line.content;
          pageContent += " ";
        }
      }
    }
  }

  console.log(pageContent);

  const nerKey = "";
  const nerEndPoint = "";
  const nerClient = new TextAnalysisClient(
    nerEndPoint,
    new nerAzureKeyCredential(nerKey)
  );

  const results = await nerClient.analyze("EntityRecognition", [pageContent]);

  return results;
}

app.storageBlob("aihireblobstoragetrigger", {
  path: "",
  connection: "",
  handler: async (blob, context) => {
    context.log(
      `Storage blob function processed blob "${context.triggerMetadata.name}" with size ${blob.length} bytes`
    );
    const blobUrl = context.triggerMetadata.uri;
    const extension = blobUrl.split(".").pop();
    if (!blobUrl) {
      // url is empty
      return;
    } else {
      //url is image
      const id = uuidv4().toString();

      const analysis = await analyzeDocument(blob);

      // `type` is the partition key
      const dataToInsertToDatabase = {
        id,
        type: extension,
        blobUrl,
        blobSize: blob.length,
        data: analysis,
        trigger: context.triggerMetadata,
      };
      console.log(dataToInsertToDatabase);
      return dataToInsertToDatabase;
    }
  },
  return: output.cosmosDB({
    connection: "CosmosDBConnection",
    databaseName: "aihirecosmosDB",
    containerName: "Documents",
  }),
});

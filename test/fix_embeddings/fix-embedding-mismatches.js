#!/usr/bin/env node

/**
 * Fix Embedding Mismatches
 * 
 * This script fixes the 100 problematic chunks
 */

require('dotenv').config({ path: '.env.local' });

const { QdrantClient } = require('@qdrant/js-client-rest');
const { google } = require('@ai-sdk/google');
const { embed } = require('ai');

async function fixEmbeddingMismatches() {
    console.log('🔧 Fixing Embedding Mismatches...\n');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'pulmo_fishman';
    const embeddingModel = google.embedding('text-embedding-004');

    const problematicChunkIds = [
        "00006fb9-f73f-4d4f-978a-38f30cf4077e",
        "0000d2b7-7b2d-4d77-9a62-93817d81c5a5",
        "0002461d-4b9a-4930-a3f0-d6528fe75638",
        "00031b43-4aa4-4e6b-8367-396faddcd103",
        "0004272b-07aa-42d4-bb7f-bdda20eb9fa9",
        "0004e588-7a6f-4f72-9e12-90e806d96f6c",
        "00056ad2-48b4-4eef-82ac-211315bae71f",
        "00085b85-0f13-4d13-a024-55e01d30cd0b",
        "0008f2bf-8a8d-4e05-9af9-39610942541e",
        "000a33d9-4551-44b1-8c56-fe35924798cf",
        "000aa6d2-e75b-48ce-8ee0-204f3c5a7d78",
        "000c403c-338b-491a-81a7-7b3d709b8f02",
        "000c5b3f-a312-4bbc-9fd5-5fee84137ae6",
        "000d45af-fa37-4dde-a88f-058d29b490e3",
        "00109ddb-0148-4b73-92be-8cc6c98575f7",
        "00129231-8c4b-47c7-be1b-99760cdc2b9b",
        "00138968-0a13-4728-98ba-6bf097768e66",
        "00151baa-4995-431a-856e-e1831cd7e42f",
        "00154c97-574f-45bc-824b-3f6f843a0c29",
        "0017574d-b0a0-4d97-9d98-8dcd5111c7a7",
        "00183ea5-fd96-43be-a142-03767e4413e3",
        "001ab964-bdc3-4ccd-9846-80b005ca9483",
        "001b0186-cd63-4eec-83ca-d9010ba30e44",
        "001d2789-71e4-4135-8e3c-a936f74b7f85",
        "001d7702-d3d9-49aa-9739-3cb5b245227c",
        "001d7944-a2bb-402b-84c9-7e066a49a24a",
        "001f09bc-99df-4cdc-90cf-61feafcb09cb",
        "001f25e4-af27-47ad-aef8-2c8a58d46961",
        "001f2baa-45f0-4dfd-a421-aa51824f09c8",
        "001ff516-fd0b-4b69-96ab-1d468cd0c882",
        "002020dd-a2cb-4a2e-b4da-c307e4aef548",
        "0021820c-05a1-416d-8937-4f8900a06dc2",
        "0022aa56-18b3-4a41-9625-5c4ea50805c0",
        "00258802-f4b6-4058-9d30-9c49d2f24b63",
        "0025e453-2787-4030-a947-bc6e98f82843",
        "00262b8e-aefd-4565-9301-35018a726ea3",
        "0026d7ee-fbd9-4967-bae5-e0e7c13b9ee3",
        "002a21be-65df-4c66-bc23-47c8b3ad831c",
        "002a49c1-683e-40a7-9b24-fb2363904362",
        "002cc61c-e653-4ae0-82b1-46efea8045db",
        "002d30d2-883c-404c-923e-e2eeba65ce08",
        "00315492-7f7d-4877-8da2-22c8e0cc9ad8",
        "003158b2-4d6e-46ad-854e-0fe45f1696dd",
        "00328f25-317b-46de-a7c6-f908b6bd8ad3",
        "00339dc9-5bd8-4401-a8a1-30ff35660721",
        "003403da-2fb1-4641-bd84-39f608eb56f7",
        "00341efa-230c-453e-8b38-2e4a97fdc68b",
        "0035b797-6c02-445d-bcfb-6c88c403a7cf",
        "0035c30f-27cb-4695-9e70-573b856eaace",
        "003609c8-508b-4c8a-9325-8ee71df8f0f0",
        "00365e42-5f5c-416e-a022-c4c0da9a2da0",
        "0037859f-945f-4322-913b-409b96642a8a",
        "0037b494-9d86-4d53-9e58-d2345c19a1a8",
        "003948e2-47e3-44f3-a3f6-c65ef703b049",
        "003a1210-71b6-4d80-a1f9-4696be19df7b",
        "003a830c-521e-43b4-985d-de27b367c40d",
        "003e1a57-21a1-4845-91ad-580bde354a44",
        "003f3bed-1e5d-4c7f-bd50-2557f27c61ad",
        "003fdcfd-5bcc-47e7-892f-907cb4a0dab0",
        "0040693d-326f-4420-a0ed-769e2449a51d",
        "0040ef79-5862-49d6-ab18-a5763666b5ab",
        "0040fb4a-7f96-470d-ac94-ffbc3487b44c",
        "0041bd56-005e-4fba-8e93-6199f85e22bf",
        "0041d959-73fd-48a8-b855-407f5e34a9e7",
        "0043dfe6-4450-4659-a7c6-2ad872fe8df7",
        "0044a3fe-39d6-4c92-b66d-d87d091929be",
        "00457bb6-6a3c-4e2e-b717-2415d84fc6b0",
        "0049914e-b0d1-4105-9ab6-30eeaf2376d9",
        "0049ad20-04cb-4d47-8ccf-c7e7c931442e",
        "0049e0f5-873d-48fb-a662-a18f30507f4f",
        "004a958e-2e56-4b79-894d-d5fcce06ea20",
        "004b23fe-828c-43bf-bbf7-856d88b05a07",
        "004e5e01-4303-4dec-b04a-1e87bc95fab5",
        "004e8e32-ed5c-43c2-b91f-011db79df5e6",
        "0050208a-c9e7-4c6a-9f70-1522db17cfdb",
        "00505ab0-4efb-47cb-8d4f-4901af212ae7",
        "00519a4b-8598-4e34-9f1b-43a40c1eae58",
        "0051bc55-d1a7-41c4-b229-9b81a1a4d6d3",
        "0052f9f1-0056-41e3-a729-43ea8b2c7e75",
        "00537841-2f81-4152-95ae-cc3460d619f3",
        "0053efd8-5baa-4814-b67e-7e803366671c",
        "005417fb-9bf4-441c-bd0e-e65ab5cb436d",
        "0054941d-1e9f-441e-a1b2-ed9997a39716",
        "0054c221-5f9a-49e2-865b-0fa18313c364",
        "00565792-cf09-4206-983c-a7149d165809",
        "00588498-2d39-4248-9a07-e0a209a0cc52",
        "0058fdb4-d72b-408f-a763-25319fc24362",
        "005f2202-e34a-4cc4-b194-83252b50888c",
        "00610b3b-7d0b-46ab-a8e6-00d9f019df9b",
        "0061eb79-1974-4154-96d5-6880b5c7996a",
        "0062038e-5f71-4dbf-968a-99a6c20f4146",
        "00623828-aa0e-48bd-a8f5-cb503977b458",
        "0065eb72-f891-4172-97ab-bdb14d50cd65",
        "00669da7-fccc-4c4f-aa65-86fb4c052b48",
        "006c4c71-91af-42bd-a481-2e1b5c213ac6",
        "006c93ba-9d74-4bb5-bf1e-709637a79c4a",
        "006e3c50-7564-4f2a-8ec8-2dca675725ce",
        "006e7c07-cd69-41c3-b77f-d520cb758e7e",
        "006f6a38-072f-4973-b3ba-87a50899ca23",
        "006f82a4-5932-4720-8a8f-ac99b0395184"
    ];

    try {
        for (let i = 0; i < problematicChunkIds.length; i++) {
            const chunkId = problematicChunkIds[i];
            console.log(`\n🔧 Fixing chunk ${i + 1}/${problematicChunkIds.length}: ${chunkId}`);
            
            // Get the chunk
            const chunk = await client.retrieve(collectionName, {
                ids: [chunkId],
                with_payload: true,
                with_vectors: false,
            });

            if (chunk.length === 0) {
                console.log(`   ❌ Chunk not found`);
                continue;
            }

            const content = chunk[0].payload?.text || chunk[0].payload?.content || chunk[0].payload?.pageContent || '';
            
            if (!content) {
                console.log(`   ❌ No content found`);
                continue;
            }

            // Generate new embedding
            const embeddingRes = await embed({
                model: embeddingModel,
                value: content,
            });

            // Update the chunk
            await client.upsert(collectionName, {
                points: [{
                    id: chunkId,
                    vector: embeddingRes.embedding,
                    payload: chunk[0].payload
                }]
            });

            console.log(`   ✅ Fixed`);
        }

        console.log('\n🎉 All problematic chunks fixed!');
        
    } catch (error) {
        console.error('❌ Fix failed:', error.message);
    }
}

fixEmbeddingMismatches().catch(console.error);
/**
 * =========================================================================
 * 黃種州個人網站 - AI 客服助理小機器人 Google Apps Script (GAS) 後端程式碼
 * =========================================================================
 * 
 * 說明：
 * 本程式負責接收個人網站前端發送的訪客訊息，加入黃種州的背景設定後，
 * 呼叫 OpenRouter API (以使用者指定的模型與 reasoning 推理模式運算)，
 * 並將小機器人的回覆回傳給前端。
 */

// =========================================================================
// 1. 請在此填入您的 OpenRouter API 金鑰與模型設定
// =========================================================================
const OPENROUTER_API_KEY = "YOUR_OPENROUTER_API_KEY"; // 👈 請將此處替換為您的 OpenRouter 金鑰 (sk-or-v1-...)
const MODEL_NAME = "anthropic/claude-haiku-5.5";      // 👈 預設模型，可依需求調整 (例如: anthropic/claude-haiku-5.5, google/gemini-2.5-flash 等)

// =========================================================================
// 2. 關於黃種州的身分設定 (System Prompt)
// =========================================================================
const SYSTEM_PROMPT = `你是「黃種州（Chung-Chou Huang）」個人網站上的專屬 AI 智慧助理小機器人。
你的任務是用親切、熱情、有禮貌且專業的口吻，回答訪客關於黃種州的學術背景、專業專長、研究方向等問題。

【黃種州的基本資料】
- 學校與學系：國立台中科技大學 日間部碩士班 室內設計系（目前研一）
- 當前修習與研究主軸：AI 應用規劃、生成式 AI 與空間規劃整合、智慧生活空間原型
- 核心專長：
  1. 空間設計與動線規劃、人體工學、施工圖說繪製
  2. 3D 數位建模與彩現：AutoCAD、SketchUp、Enscape、Rhino
  3. AI 應用規劃：Prompt Engineering、Midjourney / Stable Diffusion、MCP (Model Context Protocol) 工具整合、自動化工作流
- 研究目標：探索如何運用大語言模型與視覺生成 AI，縮短室內設計從概念發想到空間落地的週期，創造具生活溫度與前瞻科技的空間體驗。
- 所在地：台灣 台中 (Taichung, Taiwan)
- 聯絡方式：歡迎透過網站底部的 GitHub 或 Email 與種州交流合作。

【回覆準則】
1. 一律使用繁體中文回覆（除非訪客明確使用英文或其他語言提問）。
2. 自我介紹時自稱為「種州的 AI 助理小機器人」。
3. 語氣簡潔明瞭、活潑友善，多使用適當的 emoji（如 🤖、✨、📐）。
4. 如果訪客詢問無關黃種州個人或室內設計/AI領域的奇怪問題，請禮貌地委婉說明，並將話題引導回種州的專案與研究。`;

// =========================================================================
// 3. POST 請求處理 (前端聊天室發送訊息)
// =========================================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ error: "未接收到任何資料 (No post data received)" });
    }

    // 解析前端傳來的 JSON 資料
    const data = JSON.parse(e.postData.contents);
    const userMessage = data.message ? String(data.message).trim() : "";
    const history = Array.isArray(data.history) ? data.history : [];

    if (!userMessage) {
      return createJsonResponse({ error: "訊息內容不能為空" });
    }

    // 檢查 API 金鑰是否尚未替換
    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "YOUR_OPENROUTER_API_KEY") {
      return createJsonResponse({
        reply: "⚠️ 系統提示：Google Apps Script 中的 OPENROUTER_API_KEY 尚未填入，請在 GAS 程式碼最上方填入您的 OpenRouter 金鑰喔！"
      });
    }

    // 組裝 OpenRouter 的 messages 陣列
    const messages = [
      { role: "system", content: SYSTEM_PROMPT }
    ];

    // 帶入歷史對話（保留最近 6 則對話，確保連貫且節省 token）
    const recentHistory = history.slice(-6);
    recentHistory.forEach(item => {
      if (item && item.role && item.content) {
        messages.push({
          role: item.role === "assistant" ? "assistant" : "user",
          content: String(item.content)
        });
      }
    });

    // 加上使用者當前的最新問題
    messages.push({
      role: "user",
      content: userMessage
    });

    // 準備呼叫 OpenRouter API 的 Payload
    const payload = {
      model: MODEL_NAME,
      messages: messages,
      reasoning: { enabled: true } // 啟用 reasoning 思考推導功能
    };

    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "Authorization": "Bearer " + OPENROUTER_API_KEY,
        "HTTP-Referer": "https://scorpionmax1120-sketch.github.io/",
        "X-Title": "Chung-Chou Portfolio Chatbot"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    // 發送 HTTP 請求給 OpenRouter
    const response = UrlFetchApp.fetch("https://openrouter.ai/api/v1/chat/completions", options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log("OpenRouter Error: " + responseText);
      return createJsonResponse({
        error: "OpenRouter 回傳錯誤 (Status " + statusCode + ")",
        raw: responseText
      });
    }

    const responseJson = JSON.parse(responseText);

    // 提取模型回覆內容
    let replyText = "";
    if (responseJson.choices && responseJson.choices.length > 0 && responseJson.choices[0].message) {
      replyText = responseJson.choices[0].message.content || "";
    }

    if (!replyText) {
      replyText = "抱歉，小機器人暫時沒有產生回覆，請稍後再試！";
    }

    return createJsonResponse({ reply: replyText });

  } catch (err) {
    Logger.log("doPost Exception: " + err.toString());
    return createJsonResponse({ error: "伺服器發生異常: " + err.toString() });
  }
}

// =========================================================================
// 4. GET 請求處理 (可用於瀏覽器網址列快速測試服務是否在線)
// =========================================================================
function doGet(e) {
  return createJsonResponse({
    status: "ok",
    service: "Chung-Chou Portfolio AI Chatbot Backend",
    message: "Google Apps Script 服務已成功啟動！請使用 POST 請求與機器人對話。"
  });
}

// =========================================================================
// 5. 輸出 JSON 輔助函式 (自動處理 MIME 與跨來源傳遞)
// =========================================================================
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

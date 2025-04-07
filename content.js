(function () {
  // Extract quiz data from Coursera
  function extractCourseraQuiz() {
    const questions = [];
    // Updated selector to match the HTML structure you shared
    const quizTitle = document.querySelector('h1.css-6pmrmn')?.textContent.trim() || "Coursera Quiz";

    // You may need to update this selector based on Coursera's actual question markup
    const questionElements = document.querySelectorAll('[data-test="assessment-question"], [data-testid="assessment-question"]');

    questionElements.forEach((el, index) => {
      // Updated selectors to be more specific to Coursera's structure
      const text = el.querySelector('[data-test="question-prompt"], [data-testid="question-prompt"]')?.textContent.trim() 
                  || el.querySelector('.question-prompt')?.textContent.trim()
                  || `Question ${index + 1}`;
      
      // Determine question type based on input elements
      const type = el.querySelector('textarea') ? "paragraph"
                  : el.querySelector('input[type="text"]') ? "shortAnswer"
                  : el.querySelectorAll('input[type="radio"]').length ? "multipleChoice"
                  : el.querySelectorAll('input[type="checkbox"]').length ? "checkboxes"
                  : "unknown";

      let options = [];
      if (type === "multipleChoice" || type === "checkboxes") {
        // Updated selectors for option elements
        const optionElements = el.querySelectorAll('[data-test^="option-"], [data-testid^="option-"], .option-item');
        optionElements.forEach((optEl, idx) => {
          const optText = optEl.textContent.trim();
          options.push({
            text: optText,
            element: optEl
          });
        });
      }

      questions.push({
        text,
        type,
        options,
        container: el
      });
    });

    return { title: quizTitle, questions };
  }


  // Parse Gemini response
  function parseGeminiResponse(response) {
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const answers = {};
    const regex = /Question\s+(\d+):\s*(.+?)(?=Question\s+\d+:|$)/gs;
    let match;
    while ((match = regex.exec(text)) !== null) {
      answers[parseInt(match[1], 10)] = match[2].trim();
    }
    return answers;
  }

  // Send to Gemini
  async function askGemini(formData, apiKey) {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent";

    const formatted = formData.questions.map((q, i) => {
      let out = `Question ${i + 1}: ${q.text}\nType: ${q.type}`;
      if (q.options?.length) {
        q.options.forEach((o, idx) => {
          out += `\n- Option ${idx + 1}: ${o.text}`;
        });
      }
      return out;
    }).join("\n\n");

    const prompt = `
You are an AI that solves Coursera quiz questions.
Title: "${formData.title}"

${formatted}

Answer in this format:
Question 1: Option 2
Question 2: Option 1, Option 3
...
`;

    const res = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          topP: 1,
          topK: 40,
        },
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return parseGeminiResponse(data);
  }

  // Autofill Coursera quiz
  function fillCourseraQuiz(quizData, answers) {
    quizData.questions.forEach((q, i) => {
      const answer = answers[i + 1];
      if (!answer) return;

      if (q.type === "multipleChoice" || q.type === "checkboxes") {
        const selected = (answer.match(/Option\s+(\d+)/gi) || []).map(a =>
          parseInt(a.replace(/Option\s+/i, ""), 10) - 1
        );

        selected.forEach(idx => {
          const el = q.options[idx]?.element;
          if (el) el.click();
        });
      } else if (q.type === "shortAnswer" || q.type === "paragraph") {
        const input = q.container.querySelector("textarea, input[type='text']");
        if (input) {
          input.value = answer;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    });
  }

  // Expose message handler for popup or background script
  chrome.runtime.onMessage.addListener(async (req, sender, res) => {
    if (req.action === "analyzeCoursera") {
      const quiz = extractCourseraQuiz();
      try {
        const answers = await askGemini(quiz, req.apiKey);
        fillCourseraQuiz(quiz, answers);
        res({ success: true, answers });
      } catch (err) {
        res({ success: false, error: err.message });
      }
    }
  });
})();

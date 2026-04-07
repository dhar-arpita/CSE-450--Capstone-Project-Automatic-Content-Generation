
// import React, { useState } from "react";
// import { generateWorksheet } from "./api";

// export default function WorksheetGenerator({ selectedTopicId, user }) {
//   const [loading, setLoading] = useState(false);
//   const [worksheetHTML, setWorksheetHTML] = useState("");
//   const [contentId, setContentId] = useState(null); 
//   const [difficulty, setDifficulty] = useState("Medium");
//   const [numQuestions, setNumQuestions] = useState(5);

//   const onGenerate = async () => {
//     if (!selectedTopicId) {
//       alert("Please select a Topic from the dropdowns above first!");
//       return;
//     }

//     const userId = user?.user_id || 1; 

//     setLoading(true);
//     setWorksheetHTML(""); 
//     try {
//       // API call
//       const { data } = await generateWorksheet(
//         selectedTopicId, 
//         userId, 
//         difficulty.toLowerCase(), 
//         numQuestions
//       );

//       if (data && data.html) {
//         setWorksheetHTML(data.html);
//         setContentId(data.content_id); 
//       } else {
//         alert("Worksheet generated but content is empty.");
//       }
//     } catch (err) {
//       console.error("Error response:", err.response?.data);
//       alert("Failed to generate worksheet. Please check if curriculum file is uploaded.");
//     }
//     setLoading(false);
//   };

//   const handleDownloadPDF = () => {
//     if (!contentId) return;
//     window.open(`http://127.0.0.1:8000/generate/download/${contentId}`, "_blank");
//   };

//   return (
//     <div style={{ marginTop: "20px" }}>
//       {/* Config & Button Row */}
//       <div style={{ display: "flex", gap: "15px", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", backgroundColor: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #ddd" }}>
        
//         <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//           <label style={{ fontWeight: "bold" }}>Difficulty:</label>
//           <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ padding: "5px", borderRadius: "4px" }}>
//             <option value="Easy">Easy</option>
//             <option value="Medium">Medium</option>
//             <option value="Hard">Hard</option>
//           </select>
//         </div>

//         <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//           <label style={{ fontWeight: "bold" }}>Questions:</label>
//           <input 
//             type="number" 
//             value={numQuestions} 
//             onChange={(e) => setNumQuestions(e.target.value)} 
//             style={{ width: "60px", padding: "5px", borderRadius: "4px", border: "1px solid #ccc" }} 
//           />
//         </div>

//         <button 
//           onClick={onGenerate} 
//           disabled={loading || !selectedTopicId} 
//           style={{ 
//             backgroundColor: "#52c41a", color: "white", padding: "10px 20px", 
//             cursor: "pointer", border: "none", borderRadius: "6px", fontWeight: "bold",
//             opacity: (!selectedTopicId || loading) ? 0.6 : 1
//           }}
//         >
//           {loading ? "⌛ Generating..." : "✨ Generate Worksheet"}
//         </button>
//       </div>

//       {/* Preview Section */}
//       {worksheetHTML && (
//         <div style={{ marginTop: "20px", backgroundColor: "white", padding: "30px", border: "1px solid #d9d9d9", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
//           <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "15px" }}>
//             <button 
//               onClick={handleDownloadPDF} 
//               style={{ backgroundColor: "#1890ff", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
//             >
//               📥 Download as PDF
//             </button>
//           </div>
          
//           <div 
//             className="worksheet-render-area"
//             style={{ fontFamily: "serif", lineHeight: "1.6" }}
//             dangerouslySetInnerHTML={{ __html: worksheetHTML }} 
//           />
//         </div>
//       )}
//     </div>
//   );
// }

import React, { useState } from "react";
import { generateWorksheet } from "./api";

// sampleFile প্রপসটি এখানে রিসিভ করা হচ্ছে
export default function WorksheetGenerator({ selectedTopicId, user, sampleFile }) {
  const [loading, setLoading] = useState(false);
  const [worksheetHTML, setWorksheetHTML] = useState("");
  const [contentId, setContentId] = useState(null); 
  const [difficulty, setDifficulty] = useState("Medium");
  const [numQuestions, setNumQuestions] = useState(5);

  const onGenerate = async () => {
    if (!selectedTopicId) {
      alert("Please select a Topic from the dropdowns above first!");
      return;
    }

    const userId = user?.user_id || 1; 

    setLoading(true);
    setWorksheetHTML(""); 
    try {
      // API call - এখানে sampleFile প্যারামিটারটি যোগ করা হয়েছে
      const { data } = await generateWorksheet(
        selectedTopicId, 
        userId, 
        difficulty.toLowerCase(), 
        numQuestions,
        sampleFile // এই ফাইলটি এখন api.js এ চলে যাবে
      );

      if (data && data.html) {
        setWorksheetHTML(data.html);
        setContentId(data.content_id); 
      } else {
        alert("Worksheet generated but content is empty.");
      }
    } catch (err) {
      console.error("Error response:", err.response?.data);
      alert("Failed to generate worksheet. Please check if curriculum file is uploaded.");
    }
    setLoading(false);
  };

  const handleDownloadPDF = () => {
    if (!contentId) return;
    // আপনার লোকালহোস্ট ইউআরএল অনুযায়ী
    window.open(`http://127.0.0.1:8000/generate/download/${contentId}`, "_blank");
  };

  return (
    <div style={{ marginTop: "20px" }}>
      {/* Config & Button Row */}
      <div style={{ 
        display: "flex", 
        gap: "15px", 
        alignItems: "center", 
        marginBottom: "15px", 
        flexWrap: "wrap", 
        backgroundColor: "#fff", 
        padding: "15px", 
        borderRadius: "8px", 
        border: "1px solid #ddd" 
      }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>Difficulty:</label>
          <select 
            value={difficulty} 
            onChange={(e) => setDifficulty(e.target.value)} 
            style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>Questions:</label>
          <input 
            type="number" 
            value={numQuestions} 
            onChange={(e) => setNumQuestions(e.target.value)} 
            style={{ width: "60px", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }} 
            min="1"
          />
        </div>

        <button 
          onClick={onGenerate} 
          disabled={loading || !selectedTopicId} 
          style={{ 
            backgroundColor: "#52c41a", 
            color: "white", 
            padding: "10px 25px", 
            cursor: "pointer", 
            border: "none", 
            borderRadius: "6px", 
            fontWeight: "bold",
            fontSize: "15px",
            transition: "0.3s",
            opacity: (!selectedTopicId || loading) ? 0.6 : 1
          }}
        >
          {loading ? "⌛ Generating..." : "✨ Generate Worksheet"}
        </button>
      </div>

      {/* Preview Section */}
      {worksheetHTML && (
        <div style={{ 
          marginTop: "20px", 
          backgroundColor: "white", 
          padding: "40px", 
          border: "1px solid #d9d9d9", 
          borderRadius: "8px", 
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          maxWidth: "100%",
          overflowX: "auto"
        }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
            <button 
              onClick={handleDownloadPDF} 
              style={{ 
                backgroundColor: "#1890ff", 
                color: "white", 
                padding: "10px 20px", 
                border: "none", 
                borderRadius: "6px", 
                cursor: "pointer", 
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              📥 Download as PDF
            </button>
          </div>
          
          {/* এই অংশটি এআই থেকে আসা HTML রেন্ডার করবে */}
          <div 
            className="worksheet-render-area"
            style={{ 
              fontFamily: "'Times New Roman', serif", 
              lineHeight: "1.6",
              color: "#000" 
            }}
            dangerouslySetInnerHTML={{ __html: worksheetHTML }} 
          />
        </div>
      )}
    </div>
  );
}
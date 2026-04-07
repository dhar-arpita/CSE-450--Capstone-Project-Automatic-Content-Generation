

// import React, { useState } from "react";
// import { generateWorksheet } from "./api";

// // sampleFile প্রপসটি এখানে রিসিভ করা হচ্ছে
// export default function WorksheetGenerator({ selectedTopicId, user, sampleFile }) {
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
//       // API call - এখানে sampleFile প্যারামিটারটি যোগ করা হয়েছে
//       const { data } = await generateWorksheet(
//         selectedTopicId, 
//         userId, 
//         difficulty.toLowerCase(), 
//         numQuestions,
//         sampleFile // এই ফাইলটি এখন api.js এ চলে যাবে
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
//     // আপনার লোকালহোস্ট ইউআরএল অনুযায়ী
//     window.open(`http://127.0.0.1:8000/generate/download/${contentId}`, "_blank");
//   };

//   return (
//     <div style={{ marginTop: "20px" }}>
//       {/* Config & Button Row */}
//       <div style={{ 
//         display: "flex", 
//         gap: "15px", 
//         alignItems: "center", 
//         marginBottom: "15px", 
//         flexWrap: "wrap", 
//         backgroundColor: "#fff", 
//         padding: "15px", 
//         borderRadius: "8px", 
//         border: "1px solid #ddd" 
//       }}>
        
//         <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//           <label style={{ fontWeight: "bold", fontSize: "14px" }}>Difficulty:</label>
//           <select 
//             value={difficulty} 
//             onChange={(e) => setDifficulty(e.target.value)} 
//             style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
//           >
//             <option value="Easy">Easy</option>
//             <option value="Medium">Medium</option>
//             <option value="Hard">Hard</option>
//           </select>
//         </div>

//         <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//           <label style={{ fontWeight: "bold", fontSize: "14px" }}>Questions:</label>
//           <input 
//             type="number" 
//             value={numQuestions} 
//             onChange={(e) => setNumQuestions(e.target.value)} 
//             style={{ width: "60px", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }} 
//             min="1"
//           />
//         </div>

//         <button 
//           onClick={onGenerate} 
//           disabled={loading || !selectedTopicId} 
//           style={{ 
//             backgroundColor: "#52c41a", 
//             color: "white", 
//             padding: "10px 25px", 
//             cursor: "pointer", 
//             border: "none", 
//             borderRadius: "6px", 
//             fontWeight: "bold",
//             fontSize: "15px",
//             transition: "0.3s",
//             opacity: (!selectedTopicId || loading) ? 0.6 : 1
//           }}
//         >
//           {loading ? "⌛ Generating..." : "✨ Generate Worksheet"}
//         </button>
//       </div>

//       {/* Preview Section */}
//       {worksheetHTML && (
//         <div style={{ 
//           marginTop: "20px", 
//           backgroundColor: "white", 
//           padding: "40px", 
//           border: "1px solid #d9d9d9", 
//           borderRadius: "8px", 
//           boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
//           maxWidth: "100%",
//           overflowX: "auto"
//         }}>
//           <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
//             <button 
//               onClick={handleDownloadPDF} 
//               style={{ 
//                 backgroundColor: "#1890ff", 
//                 color: "white", 
//                 padding: "10px 20px", 
//                 border: "none", 
//                 borderRadius: "6px", 
//                 cursor: "pointer", 
//                 fontWeight: "bold",
//                 display: "flex",
//                 alignItems: "center",
//                 gap: "8px"
//               }}
//             >
//               📥 Download as PDF
//             </button>
//           </div>
          
//           {/* এই অংশটি এআই থেকে আসা HTML রেন্ডার করবে */}
//           <div 
//             className="worksheet-render-area"
//             style={{ 
//               fontFamily: "'Times New Roman', serif", 
//               lineHeight: "1.6",
//               color: "#000" 
//             }}
//             dangerouslySetInnerHTML={{ __html: worksheetHTML }} 
//           />
//         </div>
//       )}
//     </div>
//   );
// }

// import React, { useState } from "react";
// import { generateWorksheet } from "./api";
// import RefineWorksheet from "./RefineWorksheet"; // রিফাইনমেন্ট কম্পোনেন্টটি ইমপোর্ট করুন

// export default function WorksheetGenerator({ selectedTopicId, user, sampleFile }) {
//   const [loading, setLoading] = useState(false);
//   const [worksheetHTML, setWorksheetHTML] = useState("");
//   const [contentId, setContentId] = useState(null); 
//   const [difficulty, setDifficulty] = useState("Medium");
//   const [numQuestions, setNumQuestions] = useState(5);
  
//   // রিফাইনমেন্ট মোডাল দেখানোর জন্য স্টেট
//   const [showRefine, setShowRefine] = useState(false);

//   const onGenerate = async () => {
//     if (!selectedTopicId) {
//       alert("Please select a Topic from the dropdowns above first!");
//       return;
//     }

//     const userId = user?.user_id || 1; 

//     setLoading(true);
//     setWorksheetHTML(""); 
//     try {
//       const { data } = await generateWorksheet(
//         selectedTopicId, 
//         userId, 
//         difficulty.toLowerCase(), 
//         numQuestions,
//         sampleFile 
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

//   // রিফাইনমেন্ট থেকে আসা নতুন ডাটা দিয়ে স্টেট আপডেট করার ফাংশন
//   const handleUpdateFromRefine = (newData) => {
//     setWorksheetHTML(newData.html);
//     setContentId(newData.content_id);
//     // রিফাইনমেন্ট পেজ থেকে আপডেট হওয়ার পর নতুন HTML এখানে সরাসরি দেখা যাবে
//   };

//   return (
//     <div style={{ marginTop: "20px" }}>
//       {/* Step 2: Configuration Row */}
//       <div style={{ 
//         display: "flex", 
//         gap: "15px", 
//         alignItems: "center", 
//         marginBottom: "15px", 
//         flexWrap: "wrap", 
//         backgroundColor: "#fff", 
//         padding: "15px", 
//         borderRadius: "8px", 
//         border: "1px solid #ddd" 
//       }}>
        
//         <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//           <label style={{ fontWeight: "bold", fontSize: "14px" }}>Difficulty:</label>
//           <select 
//             value={difficulty} 
//             onChange={(e) => setDifficulty(e.target.value)} 
//             style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
//           >
//             <option value="Easy">Easy</option>
//             <option value="Medium">Medium</option>
//             <option value="Hard">Hard</option>
//           </select>
//         </div>

//         <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//           <label style={{ fontWeight: "bold", fontSize: "14px" }}>Questions:</label>
//           <input 
//             type="number" 
//             value={numQuestions} 
//             onChange={(e) => setNumQuestions(e.target.value)} 
//             style={{ width: "60px", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }} 
//             min="1"
//           />
//         </div>

//         <button 
//           onClick={onGenerate} 
//           disabled={loading || !selectedTopicId} 
//           style={{ 
//             backgroundColor: "#52c41a", 
//             color: "white", 
//             padding: "10px 25px", 
//             cursor: "pointer", 
//             border: "none", 
//             borderRadius: "6px", 
//             fontWeight: "bold",
//             fontSize: "15px",
//             opacity: (!selectedTopicId || loading) ? 0.6 : 1
//           }}
//         >
//           {loading ? "⌛ Generating..." : "✨ Generate Worksheet"}
//         </button>
//       </div>

//       {/* Preview & Action Buttons Section */}
//       {worksheetHTML && (
//         <div style={{ 
//           marginTop: "20px", 
//           backgroundColor: "white", 
//           padding: "40px", 
//           border: "1px solid #d9d9d9", 
//           borderRadius: "8px", 
//           boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
//         }}>
//           <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginBottom: "20px" }}>
            
//             {/* Modify & Regenerate বাটন */}
//             <button 
//               onClick={() => setShowRefine(true)} 
//               style={{ 
//                 backgroundColor: "#722ed1", // পার্পল কালার যাতে আলাদা করা যায়
//                 color: "white", 
//                 padding: "10px 20px", 
//                 border: "none", 
//                 borderRadius: "6px", 
//                 cursor: "pointer", 
//                 fontWeight: "bold" 
//               }}
//             >
//               🔄 Modify & Regenerate
//             </button>

//             <button 
//               onClick={handleDownloadPDF} 
//               style={{ 
//                 backgroundColor: "#1890ff", 
//                 color: "white", 
//                 padding: "10px 20px", 
//                 border: "none", 
//                 borderRadius: "6px", 
//                 cursor: "pointer", 
//                 fontWeight: "bold" 
//               }}
//             >
//               📥 Download as PDF
//             </button>
//           </div>
          
//           <div 
//             className="worksheet-render-area"
//             style={{ fontFamily: "'Times New Roman', serif", lineHeight: "1.6", color: "#000" }}
//             dangerouslySetInnerHTML={{ __html: worksheetHTML }} 
//           />
//         </div>
//       )}

//       {/* Refinement Overlay/Page */}
//       {showRefine && (
//         <RefineWorksheet 
//           contentId={contentId} 
//           onClose={() => setShowRefine(false)} 
//           onUpdate={handleUpdateFromRefine} 
//         />
//       )}
//     </div>
//   );
// }

import React, { useState } from "react";
import { generateWorksheet } from "./api";
import RefineWorksheet from "./RefineWorksheet"; 

export default function WorksheetGenerator({ selectedTopicId, user, sampleFile }) {
  const [loading, setLoading] = useState(false);
  const [worksheetHTML, setWorksheetHTML] = useState("");
  const [contentId, setContentId] = useState(null); 
  const [difficulty, setDifficulty] = useState("Medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [showRefine, setShowRefine] = useState(false);

  const onGenerate = async () => {
    if (!selectedTopicId) {
      alert("Please select a Topic from the dropdowns above first!");
      return;
    }
    const userId = user?.user_id || 1; 
    setLoading(true);
    setWorksheetHTML(""); 
    try {
      const { data } = await generateWorksheet(
        selectedTopicId, 
        userId, 
        difficulty.toLowerCase(), 
        numQuestions,
        sampleFile 
      );
      if (data && data.html) {
        setWorksheetHTML(data.html);
        setContentId(data.content_id); 
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to generate worksheet.");
    }
    setLoading(false);
  };

  const handleDownloadPDF = () => {
    if (!contentId) return;
    window.open(`http://127.0.0.1:8000/generate/download/${contentId}`, "_blank");
  };

  const handleUpdateFromRefine = (newData) => {
    setWorksheetHTML(newData.html);
    setContentId(newData.content_id);
  };

  // বাটন স্টাইলগুলো আলাদা করে ডিফাইন করা হলো যাতে কোড ক্লিন থাকে
  const buttonBase = {
    padding: "10px 20px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "0.3s"
  };

  return (
    <div style={{ marginTop: "20px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      
      {/* Step 2: Configuration Row - সেন্টারে রাখার জন্য */}
      <div style={{ 
        display: "flex", 
        gap: "20px", 
        alignItems: "center", 
        justifyContent: "center", // এলিমেন্টগুলোকে মাঝখানে আনবে
        marginBottom: "20px", 
        flexWrap: "wrap", 
        backgroundColor: "#fff", 
        padding: "20px", 
        borderRadius: "8px", 
        border: "1px solid #ddd",
        width: "100%",
        maxWidth: "900px" // একটি স্ট্যান্ডার্ড উইথ সেট করা হলো
      }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>Difficulty:</label>
          <select 
            value={difficulty} 
            onChange={(e) => setDifficulty(e.target.value)} 
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
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
            style={{ width: "70px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }} 
            min="1"
          />
        </div>

        <button 
          onClick={onGenerate} 
          disabled={loading || !selectedTopicId} 
          style={{ 
            ...buttonBase,
            backgroundColor: "#52c41a", 
            color: "white", 
            opacity: (!selectedTopicId || loading) ? 0.6 : 1
          }}
        >
          {loading ? "⌛ Generating..." : "✨ Generate Worksheet"}
        </button>
      </div>

      {/* Preview & Action Buttons Section */}
      {worksheetHTML && (
        <div style={{ 
          marginTop: "20px", 
          backgroundColor: "white", 
          padding: "40px", 
          border: "1px solid #d9d9d9", 
          borderRadius: "8px", 
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "900px", // কনফিগারেশন রোর সাথে মিল রাখা হয়েছে
          boxSizing: "border-box"
        }}>
          
          {/* বাটনগুলো এখন সুন্দরভাবে মাঝখানে থাকবে */}
          <div style={{ display: "flex", justifyContent: "center", gap: "15px", marginBottom: "30px" }}>
            <button 
              onClick={() => setShowRefine(true)} 
              style={{ ...buttonBase, backgroundColor: "#722ed1", color: "white" }}
            >
              🔄 Modify & Regenerate
            </button>

            <button 
              onClick={handleDownloadPDF} 
              style={{ ...buttonBase, backgroundColor: "#1890ff", color: "white" }}
            >
              📥 Download as PDF
            </button>
          </div>
          
          <div 
            className="worksheet-render-area"
            style={{ 
                fontFamily: "'Times New Roman', serif", 
                lineHeight: "1.6", 
                color: "#000",
                backgroundColor: "#fff",
                padding: "20px"
            }}
            dangerouslySetInnerHTML={{ __html: worksheetHTML }} 
          />
        </div>
      )}

      {/* Refinement Interface */}
      {showRefine && (
        <RefineWorksheet 
          contentId={contentId} 
          onClose={() => setShowRefine(false)} 
          onUpdate={handleUpdateFromRefine} 
        />
      )}
    </div>
  );
}
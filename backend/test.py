from services import analyze_worksheet_style

with open("/home/arpita/Desktop/Term_3-2/Capstone_Project/CSE-450--Capstone-Project-Automatic-Content-Generation/backend/Magic_Triangle_Solution_Worksheet.pdf", "rb") as f:
    style = analyze_worksheet_style(f.read())

print("=== STYLE DESCRIPTION ===")
print(style)
print(f"\n=== LENGTH: {len(style)} chars ===")
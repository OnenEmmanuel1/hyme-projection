const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

const docPath = path.join(__dirname, "project Intelligent content display system 1 to 5.docx");

mammoth.extractRawText({path: docPath})
    .then(function(result){
        var text = result.value; // The raw text
        var messages = result.messages;
        fs.writeFileSync("docs_text.txt", text);
        console.log("Successfully extracted text to docs_text.txt");
    })
    .catch(function(error) {
        console.error(error);
    });

const divs = Array.from(document.querySelectorAll(".rc-FormPartsQuestion"));
const questions = divs.map((div) => div.innerText);
const map = {};
questions.forEach((questionText) => {
  const contents = questionText.split("\n");
  const filteredContents = contents.filter((content) => content !== "");
  filteredContents.pop();
  filteredContents.shift();
  const question = filteredContents[1];
  const options = filteredContents.slice(2, contents.length - 1);
  map[question] = options;
});
console.log(map);

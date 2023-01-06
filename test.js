const fs = require("fs");

const webpack = require("./dist/index").default;

webpack({
  entries: {
    index: "./example/index.js",
  },
  externals: {
    react: true,
    "react-dom": true,
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".ts", ".json", ".css", ".img"],
  },
})
  .compile()
  .then(() => {
    const htmlTemplate = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Document</title>
    </head>
    <body>
      <script type="text/javascript" src="./manifest.js"></script>
      <script type="text/javascript" src="./index.js"></script>
    </body>
  </html>
  `;

    fs.writeFileSync("./output/index.html", htmlTemplate);
  });

import React, { Suspense, lazy } from "react";
import { render } from "react-dom";
import { asd } from "./asd.js";
import person from "./person.js";
import message from "./message";

console.error(`${person.name} said ${message} ${asd}`);

const root = document.createElement("div");

root.id = "app";

const App = lazy(() => import("./App"));

document.body.appendChild(root);

render(
  <Suspense fallback={<div>loading</div>}>
    <App />
  </Suspense>,
  root
);

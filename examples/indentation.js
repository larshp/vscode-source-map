"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Indentation = void 0;
class Indentation {
    run(js) {
        let i = 0;
        for (const l of js.split("\n")) {
            if (l.startsWith("}")) {
                i = i - 1;
            }
            if (l.endsWith(" {")) {
                i = i + 1;
            }
        }
    }
}
exports.Indentation = Indentation;
//# sourceMappingURL=indentation.js.map
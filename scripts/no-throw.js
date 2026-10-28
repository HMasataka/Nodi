export default {
  meta: { name: "nodi" },
  rules: {
    "no-throw": {
      create(context) {
        return {
          ThrowStatement(node) {
            context.report({ node, message: "throw の代わりに Result.fail を返してください" });
          },
        };
      },
    },
  },
};

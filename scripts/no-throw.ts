interface ReportDescriptor {
  node: unknown;
  message: string;
}

interface RuleContext {
  report(descriptor: ReportDescriptor): void;
}

export default {
  meta: { name: "nodi" },
  rules: {
    "no-throw": {
      create(context: RuleContext) {
        return {
          ThrowStatement(node: unknown) {
            context.report({ node, message: "throw の代わりに Result.fail を返してください" });
          },
        };
      },
    },
  },
};

// CLI Setup using dynamic import to support ESM commander in CommonJS environment
async function main() {
  const { Command } = await import("commander");
  const program = new Command();

  program
    .name("run-live-bot-e2e")
    .description("Master Live Bot E2E Dry-Run CLI Test Runner")
    .version("1.0.0");

  program
    .option(
      "-m, --mode <mode>",
      "Run mode: dry-run | live | autonomous",
      "dry-run",
    )
    .option("--peak-hours", "Run during peak hours only", false)
    .option("-l, --limit <number>", "Product limit", "5")
    .option(
      "-c, --categories <categories>",
      "Comma-separated categories",
      "kitchen,baby,skincare",
    )
    .option("--skip <stages>", "Comma-separated stages to skip", "")
    .option("-v, --verbose", "Verbose output", false)
    .action(async (options) => {
      const config = {
        mode: options.mode,
        peakHours: options.peakHours,
        productLimit: parseInt(options.limit, 10),
        categories: options.categories.split(",").map((c) => c.trim()),
        skipStages: options.skip
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        verbose: options.verbose,
      };

      const runner = new LiveBotE2ETestRunner(config);
      await runner.run();
    });

  program.parse(process.argv);
}

main().catch((err) => {
  console.error("Fatal error in E2E runner:", err);
  process.exit(1);
});
import { buildRegistryIndex } from "./build-index"
import { validateRegistry } from "./validate"

function main() {
  const command = process.argv[2] ?? "validate"

  if (command === "build-index") {
    const index = buildRegistryIndex()
    console.log(
      `✅ Index built - ${index.universities.length} universities, ` +
        `${index.majors.length} majors, ${index.charts.length} charts, ` +
        `${index.offeringTerms.length} offering terms, ` +
        `${index.courses.length} unique courses.`
    )
    return
  }

  if (command !== "validate") {
    console.error(
      `Unknown command: ${command}. Usage: registry-cli [validate|build-index]`
    )
    process.exit(1)
  }

  const result = validateRegistry()

  if (result.ok) {
    console.log(`✅ Registry valid - ${result.filesChecked} documents checked.`)
    return
  }

  console.error(`❌ Registry invalid - ${result.problems.length} problem(s):`)
  for (const p of result.problems) {
    console.error(`  ${p.path}`)
    console.error(`    └─ ${p.message}`)
  }
  process.exit(1)
}

main()

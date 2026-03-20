/**
 * CLI command implementations.
 * Each function accepts options and uses the api module.
 * console.log / console.error are used for output so they can be captured in tests.
 */
import { fetchPrompts, fetchPrompt, deletePrompt, createPrompt } from './api.js';

const DATE = ts => new Date(ts).toLocaleString();
const PAD = (s, n) => String(s).substring(0, n).padEnd(n);

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------
export async function listCommand(options) {
  const { url, search, json: jsonOut } = options;
  try {
    const prompts = await fetchPrompts(url, search);
    if (prompts.length === 0) {
      console.log('No prompts found.');
      return;
    }
    if (jsonOut) {
      console.log(JSON.stringify(prompts, null, 2));
      return;
    }
    console.log(`${'ID'.padEnd(36)}  ${'★'}  ${'TITLE'.padEnd(40)}  CREATED`);
    console.log('-'.repeat(100));
    for (const p of prompts) {
      console.log(`${PAD(p.id, 36)}  ${p.isFavorite ? '★' : ' '}  ${PAD(p.title, 40)}  ${DATE(p.createdAt)}`);
    }
    console.log(`\n${prompts.length} prompt(s)`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------
export async function getCommand(id, options) {
  const { url, json: jsonOut } = options;
  try {
    const prompt = await fetchPrompt(url, id);
    if (jsonOut) {
      console.log(JSON.stringify(prompt, null, 2));
      return;
    }
    console.log(`ID:         ${prompt.id}`);
    console.log(`Title:      ${prompt.title}`);
    console.log(`Core Idea:  ${prompt.coreIdea || '(none)'}`);
    console.log(`Favorite:   ${prompt.isFavorite ? 'yes' : 'no'}`);
    console.log(`Created:    ${DATE(prompt.createdAt)}`);
    console.log(`Updated:    ${DATE(prompt.updatedAt)}`);
    if (prompt.generatedPrompt) {
      console.log('\n--- Generated Prompt ---');
      console.log(prompt.generatedPrompt);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------
export async function deleteCommand(id, options) {
  const { url } = options;
  try {
    await deletePrompt(url, id);
    console.log(`Deleted prompt ${id}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// export
// ---------------------------------------------------------------------------
export async function exportCommand(idOrAll, options) {
  const { url, format } = options;
  try {
    const prompts = idOrAll
      ? [await fetchPrompt(url, idOrAll)]
      : await fetchPrompts(url);

    if (format === 'markdown') {
      for (const p of prompts) {
        console.log(`# ${p.title}`);
        console.log(`\n**ID:** \`${p.id}\`  `);
        console.log(`**Created:** ${DATE(p.createdAt)}\n`);
        if (p.coreIdea) console.log(`**Core Idea:** ${p.coreIdea}\n`);
        if (p.generatedPrompt) console.log(`## Generated Prompt\n\n${p.generatedPrompt}\n`);
        console.log('---\n');
      }
    } else if (format === 'text') {
      for (const p of prompts) {
        console.log(`=== ${p.title} ===`);
        if (p.generatedPrompt) console.log(p.generatedPrompt);
        console.log();
      }
    } else {
      // json (default)
      console.log(JSON.stringify(prompts.length === 1 ? prompts[0] : prompts, null, 2));
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
export async function createCommand(options) {
  const { url, title, idea, prompt: generatedPrompt, json: jsonOut } = options;
  if (!title) {
    console.error('Error: --title is required');
    process.exitCode = 1;
    return;
  }
  try {
    const record = await createPrompt(url, {
      title,
      coreIdea: idea || '',
      generatedPrompt: generatedPrompt || '',
    });
    if (jsonOut) {
      console.log(JSON.stringify(record, null, 2));
    } else {
      console.log(`Created prompt: ${record.id}  "${record.title}"`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

#!/usr/bin/node

const fs = require('fs')
const path = require('path')

const filePath = path.resolve(process.argv[2])
const fileContent = fs.readFileSync(filePath, 'utf-8')
const extension = filePath.split('.').slice(-1)[0]

const { exec } = require('child_process')

const styles = {
	dim: '\x1b[2m',
	bright: '\x1b[1m',
	reset: '\x1b[0m',
}

exec(`prettier ${filePath}`, (error, prettified, stderr) => {
	if (error || stderr) {
		return
	}

	const result = (() => {
		switch (extension) {
			case 'php':
				return prettified
					.replace(/^(\t*)\) \{$/gm, (_, tabs) =>
						[')', '{'].map((x) => tabs + x).join('\n'),
					)
					.replace(
						/^(\t*)(} )?((?:for|if|else|else ?if).+ )\{$/gm,
						(_, tabs, braceBefore, content) =>
							[
								braceBefore && '}',
								content.trim().replace(/^elseif/, 'else if'),
								'{',
							]
								.filter(Boolean)
								.map((x) => tabs + x)
								.join('\n'),
					)
			default:
				return prettified
		}
	})()

	const changed = fileContent !== result

	console.info(
		(changed ? styles.bright : styles.dim) +
			path.relative('.', filePath) +
			styles.reset,
	)

	if (changed) {
		fs.writeFileSync(filePath, result)
	}
})

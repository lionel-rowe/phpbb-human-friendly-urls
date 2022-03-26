const fs = require('fs')
const path = require('path')

const filePath = path.resolve(process.argv[2])
const fileContent = fs.readFileSync(filePath, 'utf-8')

fs.writeFileSync(
	filePath,
	fileContent
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
		),
)

console.info(path.relative('.', filePath))

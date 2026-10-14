# Third-party notices

The CDOP reference API is MIT-licensed (see [LICENSE](LICENSE)). This file covers the code and data it serves that Rethink Carbon did not write. The running service serves this file at `/licenses`, and the Docker image ships it at `/app/THIRD-PARTY-NOTICES.md`.

Server-side npm packages are not listed here: each keeps its own licence file under `node_modules` in the image.

## Zudoku

- Package: `zudoku` 0.93.0, https://github.com/zuplo/zudoku
- Served at: `/docs/` (the documentation site, built by `apps/docs`)
- Licence: MIT

`apps/docs` builds the documentation with Zudoku into static pages, which bundle Zudoku's client code and the open-source libraries it uses (React, React Router, Radix UI, Shiki, Pagefind, the Geist fonts and others). The build removes their licence comments, so it also writes `/docs/licenses.txt`: the licence of every package in the site's production dependency tree, with its licence text. That list is deliberately over-inclusive, since the tree also holds build tools that are not shipped to browsers. The API changes the pages as it serves them (ADR 0012): it removes a preconnect to `cdn.zudoku.dev` and writes in its own origin.

```text
The MIT License (MIT)

Copyright (c) Zuplo, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## HAL Explorer

- Project: `toedter/hal-explorer` 2.3.0, https://github.com/toedter/hal-explorer
- Served at: `/explorer/`
- Licence: MIT

`scripts/fetch-explorer.mjs` downloads the release build at image build time. The API changes where it fetches its themes and removes an inline event handler, as ADR 0008 describes. The build bundles other open-source libraries under their own licences; see the project's repository.

```text
MIT License

Copyright (c) 2026 Kai Toedter

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## CDOP JSON schemas and examples

- Source: https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol, at the commit pinned in `packages/cdop-schemas/UPSTREAM.json`
- Served at: `/v2/schemas/*`, and embedded verbatim in `/v2/openapi.json`
- Licence: MIT

```text
MIT License

Copyright (c) 2025 spgi-lacki

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Mapbox GL JS (loaded from Mapbox, not redistributed)

`/atlas/` makes the visitor's browser load Mapbox GL JS 3.32.0 and its stylesheet from `api.mapbox.com`, pinned with Subresource Integrity. This repository and the image do not contain it. It is licensed under the Mapbox Web SDK terms, not an open-source licence, and needs a Mapbox access token; see ADR 0010.

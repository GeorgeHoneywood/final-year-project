/** @jest-environment jsdom */
import "blob-polyfill";
import '@testing-library/jest-dom'

import { render, fireEvent, screen } from '@testing-library/svelte'
import { join } from "path"
import { dirname } from 'node:path';
import fs from "fs/promises"
import { fileURLToPath } from 'node:url';


import Map from '@/components/Map.svelte'




const getPath = (path: string) => {
    return join(dirname(fileURLToPath(import.meta.url)), "mapsforge", "files", path)
}

test('has search bar', async () => {
    render(Map, { props: { blob: new Blob([await fs.readFile(getPath("ferndown-with-debug.map"))]) } })

    const search = screen.findByPlaceholderText('10 Downing Street')
    console.log(search)
    // const heading = screen.getByText('10 Downing Street')
    // expect(heading).toBeInTheDocument()
})

// // Note: This is as an async test as we are using `fireEvent`
// test('changes button text on click', async () => {
//   render(Comp, {name: 'World'})
//   const button = screen.getByRole('button')

//   // Using await when firing events is unique to the svelte testing library because
//   // we have to wait for the next `tick` so that Svelte flushes all pending state changes.
//   await fireEvent.click(button)

//   expect(button).toHaveTextContent('Button Clicked')
// })
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CodeBlock from './CodeBlock.jsx';
import HeadingBlock from './HeadingBlock.jsx';
import MCQBlock from './MCQBlock.jsx';
import ParagraphBlock from './ParagraphBlock.jsx';
import { resolveLanguage } from './prismLanguages.js';
import { groupLines } from './richText.jsx';

describe('ParagraphBlock', () => {
  it('renders **bold** and `code` as elements', () => {
    const { container } = render(
      <ParagraphBlock text="Use **useState** to store state, e.g. `const [n, setN] = useState(0)`." />,
    );

    expect(container.querySelector('strong')).toHaveTextContent('useState');
    expect(container.querySelector('code')).toHaveTextContent('const [n, setN] = useState(0)');
    expect(container).not.toHaveTextContent('**');
  });

  it('keeps line breaks and turns "- " and "1. " lines into lists', () => {
    const { container } = render(
      <ParagraphBlock text={'First line\nSecond line\n- apples\n- **pears**\n\n1. one\n2. two'} />,
    );

    expect(container.querySelectorAll('p br')).toHaveLength(1);
    const [bullets, numbered] = screen.getAllByRole('list');
    expect(bullets.tagName).toBe('UL');
    expect(
      within(bullets)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['apples', 'pears']);
    expect(numbered.tagName).toBe('OL');
    expect(within(numbered).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows HTML in model output as text, never as markup', () => {
    const { container } = render(
      <ParagraphBlock text={'<img src=x onerror="alert(1)"> and <script>alert(1)</script>'} />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container).toHaveTextContent('<script>alert(1)</script>');
  });

  it('leaves unmatched markers alone', () => {
    render(<ParagraphBlock text="2 ** 3 is 8 and a lone ` backtick" />);

    expect(screen.getByText('2 ** 3 is 8 and a lone ` backtick')).toBeInTheDocument();
  });
});

describe('groupLines', () => {
  it('splits text into paragraphs and lists at blank lines', () => {
    expect(groupLines('a\nb\n\nc\n- x\n- y').map((g) => g.kind)).toEqual([
      'text',
      'text',
      'bullet',
    ]);
  });
});

describe('HeadingBlock', () => {
  it('renders a level-2 heading without markdown markers', () => {
    render(<HeadingBlock text="Why **hooks** matter" />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Why hooks matter');
  });
});

describe('CodeBlock', () => {
  it('highlights code and shows the language', () => {
    const { container } = render(
      <CodeBlock language="python" text={"def greet(name):\n    return f'Hi {name}'\n"} />,
    );

    expect(screen.getByText('python')).toBeInTheDocument();
    expect(container.querySelector('pre')).toHaveTextContent('def greet(name):');
    // Prism splits highlighted code into many token spans, e.g. a keyword token for "def".
    expect(container.querySelectorAll('.token').length).toBeGreaterThan(3);
    expect(container.querySelector('.token.keyword')).toHaveTextContent('def');
  });

  it('copies the code to the clipboard', async () => {
    const user = userEvent.setup();
    render(<CodeBlock language="js" text={"console.log('hi');\n"} />);

    await user.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(await navigator.clipboard.readText()).toBe("console.log('hi');");
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('reports a failed copy instead of throwing', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    render(<CodeBlock language="js" text="x" />);

    await user.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(screen.getByText('Copy failed')).toBeInTheDocument();
  });

  it.each([
    ['java', 'java'],
    ['Bash', 'bash'],
    ['sh', 'bash'],
    ['C#', 'csharp'],
    ['php', 'php'],
    ['ruby', 'ruby'],
    ['html', 'markup'],
    ['TypeScript', 'typescript'],
    ['brainfuck', 'plaintext'],
    ['', 'plaintext'],
  ])('maps language "%s" to %s', (language, expected) => {
    expect(resolveLanguage(language)).toBe(expected);
  });
});

describe('MCQBlock', () => {
  const mcq = {
    question: 'Which hook stores **state**?',
    options: ['useEffect', 'useState', 'useRef'],
    answer: 1,
    explanation: 'useState returns a value and a setter.',
    number: 2,
  };

  it('only allows checking once an option is selected', async () => {
    const user = userEvent.setup();
    render(<MCQBlock {...mcq} />);
    const check = screen.getByRole('button', { name: 'Check answer' });

    expect(screen.getByText('Question 2', { selector: 'p' })).toBeInTheDocument();
    expect(check).toBeDisabled();

    await user.click(screen.getByLabelText(/useRef/));
    expect(check).toBeEnabled();
  });

  it('confirms a correct answer with the explanation', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<MCQBlock {...mcq} onAnswer={onAnswer} />);

    await user.click(screen.getByLabelText(/useState/));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));

    expect(screen.getByRole('status')).toHaveTextContent('Correct!');
    expect(screen.getByRole('status')).toHaveTextContent('useState returns a value and a setter.');
    expect(onAnswer).toHaveBeenCalledWith(true, 1); // correct, chose option B
  });

  it('shows the right answer after a wrong one and locks the question', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<MCQBlock {...mcq} onAnswer={onAnswer} />);

    await user.click(screen.getByLabelText(/useEffect/));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));

    expect(screen.getByRole('status')).toHaveTextContent('Not quite. The answer is B.');
    expect(onAnswer).toHaveBeenCalledWith(false, 0); // wrong, chose option A
    expect(screen.queryByRole('button', { name: 'Check answer' })).toBeNull();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  });

  it('can be answered with the keyboard', async () => {
    const user = userEvent.setup();
    render(<MCQBlock {...mcq} />);

    await user.tab(); // focus the radio group
    await user.keyboard('{ArrowDown}');
    await user.tab(); // to "Check answer"
    await user.keyboard('{Enter}');

    expect(screen.getByRole('status')).toHaveTextContent('Correct!');
  });
});

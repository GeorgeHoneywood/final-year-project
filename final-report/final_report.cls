\ProvidesClass{final_report}
\LoadClass[11pt, titlepage]{report}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[dvipsnames]{xcolor}
\usepackage[paperwidth=21cm,paperheight=29.7cm,includehead,headheight=2cm,pdftex,hmargin={3cm,3cm},vmargin={1cm,2.5cm},]{geometry} 
\usepackage{fancyhdr}
\setlength{\headheight}{1.5cm}
\setlength{\parindent}{0cm} 
\renewcommand{\baselinestretch}{1.2}
\parskip=1em

\renewcommand{\contentsname}{Table of Contents}

\usepackage{fancyhdr}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[LO]{\small{\projecttitle}}
\fancyhead[RO]{\small{\studentname}}
\renewcommand{\headrulewidth}{0.1pt}
\fancyfoot[CO]{\small{Page \thepage~of~\pageref*{LastPage}}}



% \def\ps@plain{%
%       \let\@oddhead\@empty
%       \def\@oddfoot{\hfil\small{Page \thepage~of~\pageref{endpage}}\hfil}%
%       \def\@evenfoot{\hfil\small{Page \thepage~of~\pageref{endpage}}\hfil}}


% \renewcommand{\normalsize}{\fontsize{11pt}{11pt}\selectfont}
\renewcommand{\title}[1]{\huge{#1}}
\renewcommand{\author}[1]{\huge{#1}}
\newcommand{\subtitle}[1]{\textbf{\large{#1}}}
\newcommand{\abstractheading}[1]{\textbf{\Large{#1}}}
\newcommand{\code}[1]{\texttt{\footnotesize{#1}}}

\renewcommand{\section}{\@startsection
{section}%                    % the name
{1}%                          % the level
{0mm}%                        % the indent
{6mm}%             % the beforeskip
{4.2mm}%           % the afterskip
{\LARGE}}  % the style

\renewcommand{\subsection}{\@startsection
{subsection}%                    % the name
{2}%                          % the level
{0mm}%                        % the indent
{4mm}%             % the beforeskip
{1.1mm}%           % the afterskip
{\Large}}  % the style

\renewcommand{\subsubsection}{\@startsection
{subsubsection}%                    % the name
{3}%                          % the level
{0mm}%                        % the indent
{4.2mm}%             % the beforeskip
{1.1mm}%           % the afterskip
{\normalsize\bfseries}}  % the style

%\renewcommand\chapter{
%  %\thispagestyle{empty}
%  \pagestyle{fancy}
%  \doublespacing
%  \global\@topnum\z@
%  \@afterindentfalse
%  \secdef\@chapter\@schapter
%}

\renewcommand\chapter{
%\if@openright\cleardoublepage\else\clearpage\fi
                    \thispagestyle{plain}%
                    \global\@topnum\z@
                    \@afterindentfalse
                    \secdef\@chapter\@schapter}

%% Chapter headings should be at the top of the page.
\def\@makechapterhead#1{%
  { \parindent \z@ \raggedright \normalfont
    %\centering
    \ifnum \c@secnumdepth >\m@ne
        \huge{\thechapter:}
        % \par\nobreak
        %\vskip 20\p@
    \fi
    \interlinepenalty\@M
    \huge  {#1}\par\nobreak
%    \rule{5cm}{0.5pt}
    \vskip 20\p@
  } }
  
\def\@makeschapterhead#1{%
  %\vspace*{50\p@}%
  { \parindent \z@ \raggedright
    %\centering
    \normalfont
    \interlinepenalty\@M
    \huge   {#1}\par\nobreak
%    \rule{5cm}{0.5pt}
    \vskip 20\p@

  }}
  
 \renewenvironment{abstract}{%
      \chapter*{\abstractname}%
      \addcontentsline{toc}{chapter}{\abstractname}
 }
     
\makeatletter
\renewcommand{\l@chapter}{\bfseries\@dottedtocline{1}{0em}{2.3em}}
\renewcommand{\l@section}{\normalfont\@dottedtocline{2}{2em}{2.3em}}
\renewcommand{\l@subsection}{\normalfont\@dottedtocline{3}{2em}{2.3em}}
\renewcommand{\l@subsubsection}{\normalfont\@dottedtocline{4}{2em}{2.3em}}
\makeatother

\def\maketitle{\begin{titlepage}
\thispagestyle{empty}
\pagenumbering{gobble}
% \thispagestyle{myheadings}
\markright{ \hfill \textnormal{\footnotesize{\studentname, \reportyear}} \hfill }
\let\footnotesize\small \let\footnoterule\relax \setcounter{page}{0}
% \null
% \vfil
\begin{center}
\title{Final Year Project Report}\\[0.25cm]
\Large \textbf{\fullOrHalfUnit~-~\finalOrInterim}\\[0.5cm]\rule{4cm}{1pt}\\[0.7cm]
\title{\textbf{\projecttitle}}\\[0.5cm]
\author{\LARGE \studentname}\\[0.5cm]\rule{4cm}{1pt}\\[0.5cm]
{\Large  A report submitted in part fulfilment of the degree of\\[0.5cm]
\textbf{\degree}}\\[0.5cm]
{\Large  \textbf{Supervisor:}  \supervisorname}\\[1cm]
\includegraphics[height=4cm]{logo}\\[1cm]
{\Large Department of Computer Science\\
Royal Holloway, University of London\\\vfill
\normalsize \today}
\end{center}
% \vfil
% \null
\end{titlepage}
\pagenumbering{arabic}
}

\pagestyle{fancyplain}
\lhead{\footnotesize \projecttitle}
\rhead{\footnotesize \studentname}
\renewcommand{\headrulewidth}{0pt}

\usepackage{tocloft}
% \renewcommand{\cftchapfont}{\sffamily}
% \renewcommand{\cftsecfont}{\sffamily}
% \renewcommand{\cftchappagefont}{\sffamily}
% \renewcommand{\cftsecpagefont}{\sffamily}
% \renewcommand{\cftchapleader}{\cftdotfill{\cftsecdotsep}}
% \setlength{\cftbeforesecskip}{\cftbeforechapskip}
% \setcounter{tocdepth}{1}

\renewcommand{\cfttoctitlefont}{\huge}
\setlength\cftparskip{0pt} %a load of guff to make toc more compact
\setlength{\cftbeforetoctitleskip}{0pt}
\setlength\cftbeforechapskip{5pt}
\setlength\cftbeforesecskip{3pt}
\setlength\cftaftertoctitleskip{15pt}
\setlength{\cftsubsubsecindent}{3.3cm} % {2.7cm}

\usepackage{listings} %syntax highlighting
\lstdefinelanguage{JavaScript}{
  keywords={break, case, catch, continue, debugger, default, delete, do, else,
  false, finally, for, function, if, in, instanceof, new, null, return, switch,
  this, throw, true, try, typeof, var, void, while, with, let, const},
  morecomment=[l]{//},
  morecomment=[s]{/*}{*/},
  morestring=[b]',
  morestring=[b]",
  ndkeywords={class, export, boolean, throw, implements, import, this},
  keywordstyle=\color{blue}\bfseries,
  ndkeywordstyle=\color{darkgray}\bfseries,
  identifierstyle=\color{black},
  commentstyle=\color{purple}\ttfamily,
  stringstyle=\color{red}\ttfamily,
  sensitive=true
}

\definecolor{mygreen}{rgb}{0,0.6,0} %code listing formatting stuff

\lstset{language=JavaScript,
    breaklines=true, %basicstyle=\footnotesize,
    numbers=left,
    showspaces=false,
    showstringspaces=false,
    columns=fullflexible,
    upquote=true,
    %aboveskip=-14pt,
    belowskip=-4pt,
    aboveskip=14pt,
    % frame=lines,
    abovecaptionskip=-3pt,
    belowcaptionskip=8pt,
    framexleftmargin=0.5em,
    framexrightmargin=0.5em,
    %backgroundcolor=\color{LightCyan1},
    basicstyle=\footnotesize\ttfamily\color{black},
    keywordstyle=\bfseries\color{purple},
    stringstyle=\color{orange},
    % identifierstyle=\color{blue},
    commentstyle=\itshape\color{mygreen},
    numberstyle=\footnotesize\ttfamily}
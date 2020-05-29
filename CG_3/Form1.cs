using System;
using System.Windows.Forms;

namespace CG_3
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        private void glControl1_Load(object sender, EventArgs e)
        {
            View.InitShaders();
        }

        private void glControl1_Paint(object sender, PaintEventArgs e)
        {
            View.Update();
            glControl1.SwapBuffers();
        }
    }
}

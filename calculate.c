#include <stdio.h>
#include <math.h>

int main()

{

 double a,b;
 int x,y,n,i;
 char op;

 printf("==========CALCULATOR==========\n\n");
 printf("Calculate\n\n");
 printf("'A'Addition\n");
 printf("'S'Subtraction\n");
 printf("'M'Multiplication\n");
 printf("'D'Division\n");
 printf("'P'Power\n");
 printf("'R'Root \n");
 printf("'p'Percentage('p' is small)\n");
 printf("'F'Factorial\n");
 printf("'C'Sum of First n Natural Numbers\n\n");

 scanf(" %c",&op);

 switch(op)
  {
   //Addition//
   case'A':
    printf("Enter Two Number\n");
    scanf("%lf %lf",&a,&b);
    printf("Addition of (a+b)=%.0lf",a+b);
    break;

   //Substruction//
   case'S':
    printf("Enter Two Number\n");
    scanf("%lf %lf",&a,&b);
    printf("Subtraction of (a-b)=%.0lf",a-b);
    break;

   //Multiplication//
   case'M':
    printf("Enter Two Number\n");
    scanf("%lf %lf",&a,&b);
    if(b==0)
    {
      printf("Multiplication of (a*b)=0");
    }
    else
    {
      printf("Multiplication of (a*b)=%.0lf",a*b);
    }
    break;

   //Division//
   case'D':
    printf("Enter Two Number\n");
    scanf("%lf %lf",&a,&b);
    if(b==0)
    {
      printf("Something/0=Undefined"); 
    }
   else
    {
      printf("Division of (a/b)=%.0lf",a/b);
    }
    break;

   //Power//
   case'P':
    printf("Enter the base and power \n");
    scanf("%lf %lf",&a,&b);
    printf(" The exponential value is =%.0lf",pow(a,b));
    break;
    
   //Root//
   case'R':
    printf("Enter the number\n");
    scanf("%lf",&a);
    if(a<0)
    {
      printf("Complex number");
    }
    else
    {
      printf("Square root of x is=%.0lf",sqrt(a));
    }
    break;

   //Percentage//
   case'p':
    printf("Enter two number\n");
    scanf("%d %d",&x,&y);
    printf(" Percentage value is =%d",(x*y)/100);
    break;

   //Factorial//
   case'F':
    printf("Enter an integer number\n");
    scanf("%d",&n);
    if(n<0)
    {
     printf("Factorial is not possible");
    }
    else
    {
     long long fact=1;
     for(i=1; i<=n; i++)
      {
       fact *= i;
      } 
     printf("%lld",fact); 
    }
    break;

    //Sum of First n Natural Numbers//
   case'C':
    printf("Enter the value of n\n");
    scanf(" %d",&n);
    printf(" Sum of First n Natural Numbers =%d",n*(n+1)/2);
    break;
     
  default:
    printf("Invalid Operator.");
  
  }

  return 0;

}